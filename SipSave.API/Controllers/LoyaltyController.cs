using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Loyalty;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Dual-rooted loyalty controller:
///   * <c>api/v1/bars/{barId}/loyalty/...</c> — SC-16 bar-owner config + stats.
///   * <c>api/v1/loyalty/...</c>              — SC-34 end-user balance + redeem.
///
/// Thin by design — every rule (BRD §3.8: 100-pt minimum, same-bar redemption,
/// PointsPerRedemption multiples) is enforced in <see cref="ILoyaltyService"/>.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1")]
[Produces("application/json")]
public sealed class LoyaltyController : ControllerBase
{
    private readonly ILoyaltyService _loyalty;

    public LoyaltyController(ILoyaltyService loyalty)
    {
        _loyalty = loyalty;
    }

    // =========================================================================
    //  Bar-owner — SC-16
    // =========================================================================

    /// <summary>GET /api/v1/bars/:barId/loyalty/programme — SC-16 form load.
    /// Returns 204 when the bar hasn't configured loyalty yet so the UI can
    /// render the empty-state starter form.</summary>
    [HttpGet("bars/{barId:int}/loyalty/programme")]
    [ProducesResponseType(typeof(ProgrammeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<ProgrammeDto>> GetProgramme(int barId, CancellationToken ct)
    {
        var dto = await _loyalty.GetProgrammeAsync(barId, ct);
        return dto is null ? NoContent() : Ok(dto);
    }

    /// <summary>PUT /api/v1/bars/:barId/loyalty/programme — SC-16 Save.  The
    /// service upserts a single active programme per bar.</summary>
    [HttpPut("bars/{barId:int}/loyalty/programme")]
    [ProducesResponseType(typeof(ProgrammeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProgrammeDto>> ConfigureProgramme(
        int barId,
        [FromBody] ConfigureProgrammeRequest request,
        CancellationToken ct)
    {
        var dto = await _loyalty.ConfigureProgrammeAsync(barId, request, GetUserId(), ct);
        return Ok(dto);
    }

    /// <summary>GET /api/v1/bars/:barId/loyalty/stats — SC-16 live-stats tiles.</summary>
    [HttpGet("bars/{barId:int}/loyalty/stats")]
    [ProducesResponseType(typeof(ProgrammeStatsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ProgrammeStatsDto>> GetStats(int barId, CancellationToken ct)
    {
        var stats = await _loyalty.GetProgrammeStatsAsync(barId, ct);
        return Ok(stats);
    }

    // =========================================================================
    //  End user — SC-34
    // =========================================================================

    /// <summary>GET /api/v1/loyalty/summary — SC-34 header + per-bar tiles.</summary>
    [HttpGet("loyalty/summary")]
    [ProducesResponseType(typeof(UserLoyaltySummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserLoyaltySummaryDto>> GetSummary(CancellationToken ct)
    {
        var summary = await _loyalty.GetUserSummaryAsync(GetUserId(), ct);
        return Ok(summary);
    }

    /// <summary>GET /api/v1/loyalty/ledger — SC-34 earn history pagination.</summary>
    [HttpGet("loyalty/ledger")]
    [ProducesResponseType(typeof(IReadOnlyList<LoyaltyLedgerEntryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LoyaltyLedgerEntryDto>>> GetLedger(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var rows = await _loyalty.GetUserLedgerAsync(GetUserId(), skip, take, ct);
        return Ok(rows);
    }

    /// <summary>POST /api/v1/loyalty/redeem — SC-34 redeem button.  Burns the
    /// requested points and returns the paise value redeemable against a food
    /// order at the same bar.</summary>
    [HttpPost("loyalty/redeem")]
    [ProducesResponseType(typeof(RedeemResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<RedeemResponseDto>> Redeem(
        [FromBody] RedeemRequest request,
        CancellationToken ct)
    {
        var result = await _loyalty.RedeemAsync(GetUserId(), request, ct);
        return Ok(result);
    }

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
