using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>SC-08 / SC-09 user search + management.</summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/users")]
[Produces("application/json")]
public sealed class AdminUserController : ControllerBase
{
    private readonly IAdminUserService _users;

    public AdminUserController(IAdminUserService users)
    {
        _users = users;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AdminUserRowDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AdminUserRowDto>>> Search(
        [FromQuery] string? search = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default) =>
        Ok(await _users.SearchAsync(search, skip, take, ct));

    [HttpGet("{userId:int}")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserDetailDto>> GetDetail(int userId, CancellationToken ct)
    {
        var dto = await _users.GetDetailAsync(userId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{userId:int}/suspend")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AdminUserDetailDto>> Suspend(
        int userId, [FromBody] SuspendUserRequest request, CancellationToken ct) =>
        Ok(await _users.SuspendAsync(userId, request, AdminId(), ct));

    [HttpPost("{userId:int}/reactivate")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AdminUserDetailDto>> Reactivate(int userId, CancellationToken ct) =>
        Ok(await _users.ReactivateAsync(userId, AdminId(), ct));

    [HttpPost("{userId:int}/ban")]
    [ProducesResponseType(typeof(AdminUserDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminUserDetailDto>> Ban(
        int userId, [FromBody] BanUserRequest request, CancellationToken ct) =>
        Ok(await _users.BanAsync(userId, request, AdminId(), ct));

    private int AdminId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim missing or malformed.");
        return id;
    }
}
