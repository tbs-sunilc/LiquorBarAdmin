using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Wallets;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Section 3 Module C — Wallet & Payment. Controller stays thin; every business
/// rule (BR-012 atomic, BR-013 dry-day, BR-014 KYC, BR-017 top-up price, BR-018,
/// BR-042/043 gift) is enforced in <see cref="IWalletService"/>. Errors propagate
/// through <c>GlobalExceptionMiddleware</c>.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/wallets")]
[Produces("application/json")]
public sealed class WalletController : ControllerBase
{
    private readonly IWalletService _wallets;

    public WalletController(IWalletService wallets)
    {
        _wallets = wallets;
    }

    // =========================================================================
    //  Direct purchase — SC-13..17
    // =========================================================================

    /// <summary>POST /api/v1/wallets/initiate-purchase — SC-13 Buy Bottle submit.</summary>
    [HttpPost("initiate-purchase")]
    [ProducesResponseType(typeof(InitiatePurchaseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<ActionResult<InitiatePurchaseResponse>> InitiatePurchase(
        [FromBody] InitiatePurchaseRequest request,
        CancellationToken ct)
    {
        var response = await _wallets.InitiatePurchaseAsync(request, GetUserId(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/v1/wallets/confirm-payment — SC-15 checkout return / SC-17 success / SC-16 failed.</summary>
    [HttpPost("confirm-payment")]
    [ProducesResponseType(typeof(ConfirmPaymentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ConfirmPaymentResponse>> ConfirmPurchase(
        [FromBody] ConfirmPaymentRequest request,
        CancellationToken ct)
    {
        var response = await _wallets.ConfirmPurchaseAsync(request, GetUserId(), ct);
        return Ok(response);
    }

    // =========================================================================
    //  Reads — SC-18
    // =========================================================================

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<WalletSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<WalletSummaryDto>>> List(
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var rows = await _wallets.GetUserWalletsAsync(GetUserId(), includeArchived, ct);
        return Ok(rows);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(WalletDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WalletDetailDto>> Detail(int id, CancellationToken ct)
    {
        var detail = await _wallets.GetWalletDetailAsync(id, GetUserId(), ct);
        return Ok(detail);
    }

    // =========================================================================
    //  Top-up — SC-19 / SC-20
    // =========================================================================

    [HttpPost("{id:int}/topup/initiate")]
    [ProducesResponseType(typeof(InitiateTopUpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<ActionResult<InitiateTopUpResponse>> InitiateTopUp(
        int id,
        [FromBody] InitiateTopUpRequest request,
        CancellationToken ct)
    {
        var response = await _wallets.InitiateTopUpAsync(id, request, GetUserId(), ct);
        return Ok(response);
    }

    [HttpPost("{id:int}/topup/confirm")]
    [ProducesResponseType(typeof(ConfirmTopUpResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ConfirmTopUpResponse>> ConfirmTopUp(
        int id,
        [FromBody] ConfirmTopUpRequest request,
        CancellationToken ct)
    {
        var response = await _wallets.ConfirmTopUpAsync(id, request, GetUserId(), ct);
        return Ok(response);
    }

    // =========================================================================
    //  Gifts
    // =========================================================================

    [HttpPost("gifts/initiate")]
    [ProducesResponseType(typeof(InitiateGiftResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<InitiateGiftResponse>> InitiateGift(
        [FromBody] InitiateGiftRequest request,
        CancellationToken ct)
    {
        var response = await _wallets.InitiateGiftAsync(request, GetUserId(), ct);
        return Ok(response);
    }

    [HttpPost("gifts/{giftId:int}/confirm")]
    [ProducesResponseType(typeof(ConfirmGiftResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ConfirmGiftResponse>> ConfirmGift(
        int giftId,
        [FromBody] ConfirmGiftRequest request,
        CancellationToken ct)
    {
        var response = await _wallets.ConfirmGiftAsync(giftId, request, GetUserId(), ct);
        return Ok(response);
    }

    [HttpPost("gifts/{giftId:int}/accept")]
    [ProducesResponseType(typeof(AcceptGiftResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<AcceptGiftResponse>> AcceptGift(int giftId, CancellationToken ct)
    {
        var response = await _wallets.AcceptGiftAsync(giftId, GetUserId(), ct);
        return Ok(response);
    }

    [HttpPost("gifts/{giftId:int}/decline")]
    [ProducesResponseType(typeof(DeclineGiftResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<DeclineGiftResponse>> DeclineGift(int giftId, CancellationToken ct)
    {
        var response = await _wallets.DeclineGiftAsync(giftId, GetUserId(), ct);
        return Ok(response);
    }

    // -----------------------------------------------------------------------
    //  helpers
    // -----------------------------------------------------------------------
    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
