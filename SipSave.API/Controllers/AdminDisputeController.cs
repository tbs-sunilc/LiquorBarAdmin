using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>SC-06 / SC-07 dispute admin surface.</summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/disputes")]
[Produces("application/json")]
public sealed class AdminDisputeController : ControllerBase
{
    private readonly IAdminDisputeService _disputes;

    public AdminDisputeController(IAdminDisputeService disputes)
    {
        _disputes = disputes;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<DisputeRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DisputeRowDto>>> GetQueue(
        [FromQuery] string? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default) =>
        Ok(await _disputes.GetQueueAsync(status, skip, take, ct));

    [HttpGet("{disputeId:int}")]
    [ProducesResponseType(typeof(DisputeDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DisputeDetailDto>> GetDetail(int disputeId, CancellationToken ct)
    {
        var dto = await _disputes.GetDetailAsync(disputeId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{disputeId:int}/assign")]
    [ProducesResponseType(typeof(DisputeDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<DisputeDetailDto>> Assign(
        int disputeId, [FromBody] AssignDisputeRequest request, CancellationToken ct) =>
        Ok(await _disputes.AssignAsync(disputeId, request, AdminId(), ct));

    [HttpPost("{disputeId:int}/resolve")]
    [ProducesResponseType(typeof(DisputeDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DisputeDetailDto>> Resolve(
        int disputeId, [FromBody] ResolveDisputeRequest request, CancellationToken ct) =>
        Ok(await _disputes.ResolveAsync(disputeId, request, AdminId(), ct));

    private int AdminId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim missing or malformed.");
        return id;
    }
}
