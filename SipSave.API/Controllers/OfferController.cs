using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Offers;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-13 (list) / SC-14 (create) offers surface for bar owners.  The controller
/// stays thin — every business rule (overlap detection, HappyHour ≤ 50%, date
/// sanity) lives in <see cref="IOfferService"/>.
///
/// Authorisation today is <c>[Authorize]</c> only; the ownership check (bar
/// belongs to the authenticated user) lands in Phase 8 when the bar-owner auth
/// flow issues tokens with an <c>owned_bars</c> claim.  Until then the service
/// layer is the only gate.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1")]
[Produces("application/json")]
public sealed class OfferController : ControllerBase
{
    private readonly IOfferService _offers;

    public OfferController(IOfferService offers)
    {
        _offers = offers;
    }

    /// <summary>GET /api/v1/bars/:barId/offers — SC-13 list.</summary>
    [HttpGet("bars/{barId:int}/offers")]
    [ProducesResponseType(typeof(IReadOnlyList<OfferDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<OfferDto>>> ListByBar(
        int barId,
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var rows = await _offers.ListByBarAsync(barId, includeInactive, ct);
        return Ok(rows);
    }

    /// <summary>POST /api/v1/bars/:barId/offers — SC-14 Create.  Returns 400
    /// with the conflict copy when a HappyHour overlap is detected.</summary>
    [HttpPost("bars/{barId:int}/offers")]
    [ProducesResponseType(typeof(OfferDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OfferDto>> Create(
        int barId,
        [FromBody] CreateOfferRequest request,
        CancellationToken ct)
    {
        var offer = await _offers.CreateAsync(barId, request, GetUserId(), ct);
        return CreatedAtAction(nameof(GetById), new { id = offer.Id }, offer);
    }

    /// <summary>GET /api/v1/offers/:id — SC-14 detail.</summary>
    [HttpGet("offers/{id:int}")]
    [ProducesResponseType(typeof(OfferDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OfferDto>> GetById(int id, CancellationToken ct)
    {
        var offer = await _offers.GetByIdAsync(id, ct);
        return offer is null ? NotFound() : Ok(offer);
    }

    /// <summary>PUT /api/v1/offers/:id/active — SC-13 row toggle.</summary>
    [HttpPut("offers/{id:int}/active")]
    [ProducesResponseType(typeof(OfferDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OfferDto>> SetActive(
        int id,
        [FromBody] SetOfferActiveRequest request,
        CancellationToken ct)
    {
        var offer = await _offers.SetActiveAsync(id, request.IsActive, ct);
        return Ok(offer);
    }

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}

/// <summary>PUT /api/v1/offers/:id/active — SC-13 activate/pause toggle payload.</summary>
public sealed record SetOfferActiveRequest(bool IsActive);
