using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Revenue;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-15 Revenue Analytics.  One endpoint returns the full report, a second
/// streams the same numbers as PDF or CSV for accountants.
///
/// Range selection:
///   * <c>preset</c> — <c>ThisMonth</c> (default) / <c>LastMonth</c> /
///     <c>Last3Months</c> — service derives the window from IST today.
///   * <c>preset=Custom</c> — both <c>from</c> and <c>to</c> (ISO dates) are
///     required; the service 400s otherwise.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/bars/{barId:int}/revenue")]
[Produces("application/json")]
public sealed class RevenueController : ControllerBase
{
    private readonly IRevenueService _revenue;

    public RevenueController(IRevenueService revenue)
    {
        _revenue = revenue;
    }

    /// <summary>GET /api/v1/bars/:barId/revenue — SC-15 report.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(RevenueReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RevenueReportDto>> Get(
        int barId,
        [FromQuery] RevenueRangePreset preset = RevenueRangePreset.ThisMonth,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken ct = default)
    {
        var dto = await _revenue.GetAsync(barId, preset, from, to, ct);
        return Ok(dto);
    }

    /// <summary>GET /api/v1/bars/:barId/revenue/export?format=pdf|csv — SC-15 download.</summary>
    [HttpGet("export")]
    [Produces("application/pdf", "text/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Export(
        int barId,
        [FromQuery] string format = "pdf",
        [FromQuery] RevenueRangePreset preset = RevenueRangePreset.ThisMonth,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken ct = default)
    {
        var file = await _revenue.ExportAsync(barId, preset, from, to, format, ct);
        return File(file.Bytes, file.ContentType, file.FileName);
    }
}
