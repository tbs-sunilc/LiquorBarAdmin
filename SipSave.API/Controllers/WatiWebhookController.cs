using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SipSave.Application.Interfaces;
using SipSave.Application.Options;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-33 incoming WATI webhook.  WATI posts every inbound bot message here;
/// we validate the shared secret, dispatch to <see cref="IBotCommandProcessor"/>,
/// then send the reply back via WATI session-message.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/webhooks/wati")]
[Produces("application/json")]
public sealed class WatiWebhookController : ControllerBase
{
    private readonly IBotCommandProcessor _bot;
    private readonly IWatiService _wati;
    private readonly WatiOptions _options;
    private readonly ILogger<WatiWebhookController> _logger;

    public WatiWebhookController(
        IBotCommandProcessor bot,
        IWatiService wati,
        IOptions<WatiOptions> options,
        ILogger<WatiWebhookController> logger)
    {
        _bot = bot;
        _wati = wati;
        _options = options.Value;
        _logger = logger;
    }

    [HttpPost("inbound")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Inbound([FromBody] WatiInboundPayload payload, CancellationToken ct)
    {
        // Shared-secret gate — WATI forwards it in a configurable header.
        if (!string.IsNullOrEmpty(_options.WebhookSecret))
        {
            var headerSecret = Request.Headers["X-WATI-Secret"].ToString();
            if (!string.Equals(headerSecret, _options.WebhookSecret, StringComparison.Ordinal))
            {
                _logger.LogWarning("WATI webhook rejected — bad or missing secret.");
                return Unauthorized();
            }
        }

        // WATI sends many event types (messages, delivery receipts, status
        // updates).  We only act on inbound text.
        if (!string.Equals(payload.EventType, "message", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(payload.EventType, "messageEvent", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(new { ignored = true });
        }
        if (string.IsNullOrWhiteSpace(payload.WaId) || string.IsNullOrWhiteSpace(payload.Text))
        {
            return Ok(new { ignored = true });
        }

        try
        {
            var reply = await _bot.HandleMessageAsync(payload.WaId, payload.Text, ct);
            await _wati.SendSessionTextAsync(payload.WaId, reply, ct);
            _logger.LogInformation("WATI bot replied to {WaId} ({Len} chars).", payload.WaId, reply.Length);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WATI bot handler threw for WaId={WaId}.", payload.WaId);
            // Always 200 — WATI retries on non-2xx, which would duplicate the
            // user-facing reply.  Errors are only logged server-side.
        }

        return Ok();
    }
}

/// <summary>WATI inbound-message JSON — only the fields the bot cares about.</summary>
public sealed record WatiInboundPayload(
    string? EventType,
    string? WaId,
    string? Text,
    string? SenderName);
