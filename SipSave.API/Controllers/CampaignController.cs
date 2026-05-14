using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Campaigns;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-17 re-engagement campaigns.  All three endpoints are bar-owner scoped.
/// The service owns BR-044 (2 distinct campaigns per user per month), variable
/// substitution, and the multi-channel fan-out — the controller stays thin.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/bars/{barId:int}/campaigns")]
[Produces("application/json")]
public sealed class CampaignController : ControllerBase
{
    private readonly ICampaignService _campaigns;

    public CampaignController(ICampaignService campaigns)
    {
        _campaigns = campaigns;
    }

    /// <summary>GET …/campaigns/dormant-users?daysInactive=30 — SC-17 table.</summary>
    [HttpGet("dormant-users")]
    [ProducesResponseType(typeof(IReadOnlyList<DormantUserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DormantUserDto>>> GetDormantUsers(
        int barId,
        [FromQuery] int daysInactive = 30,
        CancellationToken ct = default)
    {
        var rows = await _campaigns.GetDormantUsersAsync(barId, daysInactive, ct);
        return Ok(rows);
    }

    /// <summary>POST …/campaigns — SC-17 composer submit.  Over-cap recipients
    /// come back in <see cref="CampaignResultDto.Skipped"/> so the UI can
    /// show the "2 users were at their monthly cap" banner.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(CampaignResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignResultDto>> Create(
        int barId,
        [FromBody] CreateCampaignRequest request,
        CancellationToken ct)
    {
        var result = await _campaigns.CreateAsync(barId, request, GetUserId(), ct);
        return Ok(result);
    }

    /// <summary>GET …/campaigns?take=25 — SC-17 history.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CampaignHistoryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CampaignHistoryDto>>> GetRecent(
        int barId,
        [FromQuery] int take = 25,
        CancellationToken ct = default)
    {
        var rows = await _campaigns.GetRecentAsync(barId, take, ct);
        return Ok(rows);
    }

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
