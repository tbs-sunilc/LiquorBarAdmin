using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Admin;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// SC-01 platform-admin authentication.  Anonymous (login + verify-mfa +
/// refresh) since the caller has no token yet.  Logout requires a valid
/// admin JWT.  IP for rate limiting comes from the connection — note this
/// trusts the immediate hop; a forwarded-header story is a Phase-10 ops
/// detail (X-Forwarded-For sanitisation belongs in middleware, not here).
/// </summary>
[ApiController]
[Route("api/admin/auth")]
[Produces("application/json")]
public sealed class AdminAuthController : ControllerBase
{
    private readonly IAdminAuthService _auth;

    public AdminAuthController(IAdminAuthService auth)
    {
        _auth = auth;
    }

    /// <summary>POST /api/admin/auth/login — SC-01 step 1.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(typeof(AdminLoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AdminLoginResponse>> Login(
        [FromBody] AdminLoginRequest request,
        CancellationToken ct)
    {
        var response = await _auth.LoginAsync(request, ClientIp(), UserAgent(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/admin/auth/verify-mfa — SC-01 step 2.</summary>
    [AllowAnonymous]
    [HttpPost("verify-mfa")]
    [ProducesResponseType(typeof(AdminSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AdminSessionDto>> VerifyMfa(
        [FromBody] AdminMfaVerifyRequest request,
        CancellationToken ct)
    {
        var session = await _auth.VerifyMfaAsync(request, ClientIp(), UserAgent(), ct);
        return Ok(session);
    }

    /// <summary>POST /api/admin/auth/refresh — rotate the refresh token.</summary>
    [AllowAnonymous]
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AdminSessionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AdminSessionDto>> Refresh(
        [FromBody] AdminRefreshRequest request,
        CancellationToken ct)
    {
        var session = await _auth.RefreshAsync(request, ClientIp(), UserAgent(), ct);
        return Ok(session);
    }

    /// <summary>POST /api/admin/auth/logout — revoke a single refresh token.</summary>
    [Authorize(Roles = "admin")]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout([FromBody] AdminRefreshRequest request, CancellationToken ct)
    {
        await _auth.LogoutAsync(request.RefreshToken, ct);
        return NoContent();
    }

    private string ClientIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private string? UserAgent() =>
        Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null;
}
