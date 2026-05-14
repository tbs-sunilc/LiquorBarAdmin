using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Staff;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-11 staff table + SC-12 add-staff form.  Dual-rooted like OfferController:
///   * <c>/api/v1/bars/{barId}/staff</c>   — bar-scoped list + create.
///   * <c>/api/v1/staff/{id}</c>           — flat resource routes for toggle + detail.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1")]
[Produces("application/json")]
public sealed class StaffController : ControllerBase
{
    private readonly IStaffService _staff;

    public StaffController(IStaffService staff)
    {
        _staff = staff;
    }

    /// <summary>GET /api/v1/bars/:barId/staff — SC-11 table.</summary>
    [HttpGet("bars/{barId:int}/staff")]
    [ProducesResponseType(typeof(IReadOnlyList<StaffRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<StaffRowDto>>> ListForBar(int barId, CancellationToken ct)
    {
        var rows = await _staff.ListForBarAsync(barId, ct);
        return Ok(rows);
    }

    /// <summary>POST /api/v1/bars/:barId/staff — SC-12 submit.  Returns 201 with
    /// the new row; 400 if the mobile collides or the role is unknown.</summary>
    [HttpPost("bars/{barId:int}/staff")]
    [ProducesResponseType(typeof(StaffRowDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffRowDto>> Create(
        int barId,
        [FromBody] CreateStaffRequest request,
        CancellationToken ct)
    {
        var row = await _staff.CreateAsync(barId, request, GetUserId(), ct);
        return CreatedAtAction(nameof(GetById), new { id = row.Id }, row);
    }

    /// <summary>GET /api/v1/staff/:id — SC-11 detail.</summary>
    [HttpGet("staff/{id:int}")]
    [ProducesResponseType(typeof(StaffRowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffRowDto>> GetById(int id, CancellationToken ct)
    {
        var row = await _staff.GetByIdAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    /// <summary>PUT /api/v1/staff/:id/active — SC-11 activate / deactivate.</summary>
    [HttpPut("staff/{id:int}/active")]
    [ProducesResponseType(typeof(StaffRowDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StaffRowDto>> SetActive(
        int id,
        [FromBody] SetStaffActiveRequest request,
        CancellationToken ct)
    {
        var row = await _staff.SetActiveAsync(id, request.IsActive, ct);
        return Ok(row);
    }

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
