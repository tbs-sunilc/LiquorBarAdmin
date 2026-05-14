using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Domain.Entities;
using SipSave.Domain.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>SC-11 dry-day calendar management.  List / add / deactivate.
/// The BR-013 gate that actually blocks wallet purchases lives in
/// <c>DryDayService</c> (Phase 4) and reads the same table.</summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/dry-days")]
[Produces("application/json")]
public sealed class AdminDryDayController : ControllerBase
{
    private readonly IDryDayRepository _dryDays;

    public AdminDryDayController(IDryDayRepository dryDays)
    {
        _dryDays = dryDays;
    }

    /// <summary>GET /api/admin/dry-days?stateCode=MH&amp;from=2026-04-01&amp;to=2026-12-31
    /// — SC-11 calendar.  Defaults to the current calendar year if dates are omitted.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<DryDayRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DryDayRowDto>>> List(
        [FromQuery] string? stateCode = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveFrom = from ?? new DateOnly(today.Year, 1, 1);
        var effectiveTo = to ?? new DateOnly(today.Year, 12, 31);
        var rows = await _dryDays.GetCalendarAsync(stateCode, effectiveFrom, effectiveTo, ct);
        return Ok(rows.Select(ToDto).ToList());
    }

    [HttpPost]
    [ProducesResponseType(typeof(DryDayRowDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<DryDayRowDto>> Add(
        [FromBody] CreateDryDayRequest request,
        CancellationToken ct)
    {
        var entity = new DryDay
        {
            StateCode         = request.StateCode.Trim().ToUpperInvariant(),
            DryDate           = request.DryDate,
            Title             = request.Title.Trim(),
            Description       = request.Description?.Trim(),
            IsRecurringYearly = request.IsRecurringYearly,
            CreatedByAdminId  = AdminId(),
            IsActive          = true,
            CreatedBy         = AdminId()
        };
        entity.Id = await _dryDays.AddAsync(entity, ct);
        return CreatedAtAction(nameof(List), new { }, ToDto(entity));
    }

    [HttpPut("{dryDayId:int}/active")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> SetActive(int dryDayId, [FromBody] SetActiveRequest request, CancellationToken ct)
    {
        await _dryDays.SetActiveAsync(dryDayId, request.IsActive, ct);
        return NoContent();
    }

    private int AdminId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim missing or malformed.");
        return id;
    }

    private static DryDayRowDto ToDto(DryDay d) => new(
        Id:                d.Id,
        StateCode:         d.StateCode,
        DryDate:           d.DryDate,
        Title:             d.Title,
        Description:       d.Description,
        IsRecurringYearly: d.IsRecurringYearly,
        IsActive:          d.IsActive,
        CreatedAtUtc:      d.CreatedAt);
}
