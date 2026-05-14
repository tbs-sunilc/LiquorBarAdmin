using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Dashboard;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-07 Bar Owner home.  One endpoint returns the entire page payload — KPI
/// tiles, 7-day revenue chart, top bottles, recent transactions, subscription
/// banner.  Every aggregation lives in <see cref="IDashboardService"/>.
///
/// Ownership enforcement (that the caller actually owns <c>barId</c>) is the
/// same Phase-8 claim-gated story as every other bar-scoped controller — not
/// wired at the controller yet; the service only trusts existence of the bar.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/bars/{barId:int}/dashboard")]
[Produces("application/json")]
public sealed class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboard;

    public DashboardController(IDashboardService dashboard)
    {
        _dashboard = dashboard;
    }

    /// <summary>GET /api/v1/bars/:barId/dashboard — SC-07 cold load.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(DashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DashboardDto>> Get(int barId, CancellationToken ct)
    {
        var dto = await _dashboard.GetAsync(barId, ct);
        return Ok(dto);
    }
}
