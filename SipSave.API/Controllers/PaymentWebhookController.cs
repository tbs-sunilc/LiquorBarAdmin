using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Razorpay webhook receiver. CLAUDE.md Rule 8: verify HMAC-SHA256 signature
/// from the <c>X-Razorpay-Signature</c> header against the RAW request body BEFORE
/// processing. Returns 200 even for events we ignore so Razorpay doesn't
/// over-retry; returns 401 only when the signature fails.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/webhooks/razorpay")]
public sealed class PaymentWebhookController : ControllerBase
{
    private readonly IRazorpayService _razorpay;
    private readonly IWalletService _wallets;
    private readonly ILogger<PaymentWebhookController> _logger;

    public PaymentWebhookController(IRazorpayService razorpay, IWalletService wallets, ILogger<PaymentWebhookController> logger)
    {
        _razorpay = razorpay;
        _wallets = wallets;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/v1/webhooks/razorpay
    /// Body is read as raw bytes — model binding would re-serialise and break the signature.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        // Read the raw body into a byte[] for HMAC verification.
        byte[] raw;
        using (var ms = new MemoryStream())
        {
            await Request.Body.CopyToAsync(ms, ct);
            raw = ms.ToArray();
        }
        if (raw.Length == 0) return BadRequest(new { error = "empty_body" });

        var signature = Request.Headers["X-Razorpay-Signature"].ToString();
        if (string.IsNullOrWhiteSpace(signature))
        {
            _logger.LogWarning("Razorpay webhook missing X-Razorpay-Signature header.");
            return Unauthorized(new { error = "missing_signature" });
        }

        if (!_razorpay.VerifyWebhookSignature(raw, signature))
        {
            _logger.LogWarning("Razorpay webhook signature verification failed.");
            return Unauthorized(new { error = "signature_mismatch" });
        }

        // Parse the body AFTER we've verified — cheap JSON read.
        RazorpayWebhookEnvelope? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<RazorpayWebhookEnvelope>(raw, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Razorpay webhook body is not valid JSON.");
            return BadRequest(new { error = "invalid_json" });
        }

        if (envelope is null || string.IsNullOrEmpty(envelope.Event))
            return BadRequest(new { error = "missing_event" });

        var eventId = envelope.Id ?? Request.Headers["X-Razorpay-Event-Id"].ToString();
        var payment = envelope.Payload?.Payment?.Entity;

        _logger.LogInformation("Razorpay webhook event={Event} id={Id} order={Order}", envelope.Event, eventId, payment?.OrderId ?? "-");

        // Dispatch by event type. Unknown events acknowledged with 200 so Razorpay stops retrying.
        try
        {
            switch (envelope.Event)
            {
                case "payment.captured":
                    if (payment is { OrderId: { } orderId, Id: { } paymentId })
                    {
                        await _wallets.HandleCapturedWebhookAsync(
                            razorpayOrderId:   orderId,
                            razorpayPaymentId: paymentId,
                            razorpayEventId:   string.IsNullOrEmpty(eventId) ? paymentId : eventId,
                            paymentMethod:     payment.Method ?? "unknown",
                            rawPayload:        System.Text.Encoding.UTF8.GetString(raw),
                            ct: ct);
                    }
                    break;

                case "payment.failed":
                    if (payment?.OrderId is { } failedOrder)
                    {
                        await _wallets.HandleFailedWebhookAsync(
                            razorpayOrderId: failedOrder,
                            reason:          payment.ErrorDescription ?? payment.ErrorCode ?? "payment_failed",
                            rawPayload:      System.Text.Encoding.UTF8.GetString(raw),
                            ct: ct);
                    }
                    break;

                // refund.created, subscription.charged, etc. — Phase 7 will wire these.
                default:
                    _logger.LogInformation("Razorpay webhook event {Event} not handled; acknowledging.", envelope.Event);
                    break;
            }
        }
        catch (Exception ex)
        {
            // We return 500 only on truly unexpected errors; Razorpay retries with exponential backoff.
            _logger.LogError(ex, "Unhandled exception while processing Razorpay webhook {Event} {Id}", envelope.Event, eventId);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "processing_error" });
        }

        return Ok(new { received = true });
    }

    // =========================================================================
    //  Razorpay webhook shape — we only parse the fields we act on.
    // =========================================================================
    private sealed record RazorpayWebhookEnvelope(
        string? Event,
        string? Id,
        RazorpayWebhookPayload? Payload);

    private sealed record RazorpayWebhookPayload(RazorpayWebhookPayment? Payment);

    private sealed record RazorpayWebhookPayment(RazorpayWebhookPaymentEntity? Entity);

    private sealed record RazorpayWebhookPaymentEntity(
        string? Id,
        [property: System.Text.Json.Serialization.JsonPropertyName("order_id")] string? OrderId,
        string? Method,
        string? Status,
        long? Amount,
        [property: System.Text.Json.Serialization.JsonPropertyName("error_code")] string? ErrorCode,
        [property: System.Text.Json.Serialization.JsonPropertyName("error_description")] string? ErrorDescription);
}
