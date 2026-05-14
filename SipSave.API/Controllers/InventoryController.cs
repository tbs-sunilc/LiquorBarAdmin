using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Inventory;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Inventory management (Prototype 2 SC-08 / SC-09 / SC-10). Every route is
/// [Authorize] and the service layer verifies the caller owns the bar the
/// inventory row belongs to — a non-owner gets 401 (not 403) because we don't
/// leak which bar-id maps to which owner.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1")]
[Produces("application/json")]
public sealed class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventory;

    public InventoryController(IInventoryService inventory)
    {
        _inventory = inventory;
    }

    // =========================================================================
    //  Bar-scoped routes
    // =========================================================================

    /// <summary>GET /api/v1/bars/{barId}/inventory — SC-08 table rows.</summary>
    [HttpGet("bars/{barId:int}/inventory")]
    [ProducesResponseType(typeof(IReadOnlyList<InventoryItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<InventoryItemDto>>> ListForBar(
        int barId,
        [FromQuery] bool includeUnavailable = true,
        CancellationToken ct = default)
    {
        var items = await _inventory.ListForBarAsync(barId, GetUserId(), includeUnavailable, ct);
        return Ok(items);
    }

    /// <summary>GET /api/v1/bars/{barId}/inventory/catalogue-search — SC-09 search.</summary>
    [HttpGet("bars/{barId:int}/inventory/catalogue-search")]
    [ProducesResponseType(typeof(IReadOnlyList<BottleCatalogueSearchResult>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BottleCatalogueSearchResult>>> SearchCatalogue(
        int barId,
        [FromQuery] string? q,
        [FromQuery] string? category,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        CancellationToken ct = default)
    {
        var rows = await _inventory.SearchCatalogueAsync(barId, GetUserId(), q, category, skip, take, ct);
        return Ok(rows);
    }

    /// <summary>POST /api/v1/bars/{barId}/inventory — SC-09 bottle-form submit.</summary>
    [HttpPost("bars/{barId:int}/inventory")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> Add(
        int barId,
        [FromBody] AddBottleToInventoryRequest request,
        CancellationToken ct)
    {
        var created = await _inventory.AddAsync(barId, request, GetUserId(), ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    // =========================================================================
    //  Item-scoped routes
    // =========================================================================

    /// <summary>GET /api/v1/inventory/{id}.</summary>
    [HttpGet("inventory/{id:int}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> Get(int id, CancellationToken ct)
    {
        var item = await _inventory.GetByIdAsync(id, GetUserId(), ct);
        return Ok(item);
    }

    /// <summary>PUT /api/v1/inventory/{id} — SC-10 edit form.</summary>
    [HttpPut("inventory/{id:int}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> Update(
        int id,
        [FromBody] UpdateInventoryRequest request,
        CancellationToken ct)
    {
        var updated = await _inventory.UpdateAsync(id, request, GetUserId(), ct);
        return Ok(updated);
    }

    /// <summary>PUT /api/v1/inventory/{id}/availability — SC-08 enable/disable toggle.</summary>
    [HttpPut("inventory/{id:int}/availability")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> SetAvailability(
        int id,
        [FromBody] AvailabilityBody body,
        CancellationToken ct)
    {
        var updated = await _inventory.SetAvailabilityAsync(id, body.IsAvailable, GetUserId(), ct);
        return Ok(updated);
    }

    /// <summary>POST /api/v1/inventory/{id}/adjustments — quick stock in/out/waste/reconciliation.</summary>
    [HttpPost("inventory/{id:int}/adjustments")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryItemDto>> Adjust(
        int id,
        [FromBody] StockAdjustmentRequest request,
        CancellationToken ct)
    {
        var updated = await _inventory.AdjustStockAsync(id, request, GetUserId(), ct);
        return Ok(updated);
    }

    /// <summary>DELETE /api/v1/inventory/{id} — SC-10 danger-zone soft delete.</summary>
    [HttpDelete("inventory/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _inventory.DeleteAsync(id, GetUserId(), ct);
        return NoContent();
    }

    // -----------------------------------------------------------------------
    //  helpers
    // -----------------------------------------------------------------------
    public sealed record AvailabilityBody(bool IsAvailable);

    private int GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
