using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Auth;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Endpoints for Section 3 Module A — Auth. Controller is intentionally thin:
/// every business rule (BR-001 lockout, BR-002 OTP TTL, 5-per-15-min send throttle,
/// refresh-token rotation, family-revocation on theft) is implemented inside
/// <see cref="IAuthService"/>. Exceptions bubble up to
/// <see cref="Middleware.GlobalExceptionMiddleware"/> which emits problem+json with
/// the right status code and <c>OtpFailureDetails</c> extension so the Flutter
/// layer can render SC-04 / SC-05 / SC-06 directly.
/// </summary>
[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    /// <summary>POST /api/v1/auth/register — SC-03 submit + SC-04 "Resend OTP".</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status502BadGateway)]
    public async Task<ActionResult<RegisterResponse>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken ct)
    {
        var response = await _auth.RegisterAsync(request, ClientIp(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/v1/auth/verify-otp — SC-04 submit; errors drive SC-05 / SC-06.</summary>
    [HttpPost("verify-otp")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(VerifyOtpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status423Locked)]
    public async Task<ActionResult<VerifyOtpResponse>> VerifyOtp(
        [FromBody] VerifyOtpRequest request,
        CancellationToken ct)
    {
        var response = await _auth.VerifyOtpAsync(request, ClientIp(), UserAgent(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/v1/auth/refresh — rotate access + refresh tokens.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RefreshTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<RefreshTokenResponse>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken ct)
    {
        var response = await _auth.RefreshTokenAsync(request, ClientIp(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/v1/auth/logout — revoke the supplied refresh token.</summary>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout(
        [FromBody] LogoutRequest request,
        CancellationToken ct)
    {
        await _auth.LogoutAsync(request, GetUserId(), ct);
        return NoContent();
    }

    /// <summary>POST /api/v1/auth/sso/google — SC-03 Google button flow.</summary>
    [HttpPost("sso/google")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(VerifyOtpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public async Task<ActionResult<VerifyOtpResponse>> SsoGoogle(
        [FromBody] SsoTokenBody body,
        CancellationToken ct)
    {
        var request = new SsoLoginRequest(Provider: "Google", IdToken: body.IdToken);
        var response = await _auth.SsoLoginAsync(request, ClientIp(), UserAgent(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/v1/auth/sso/apple — SC-03 Apple button flow.</summary>
    [HttpPost("sso/apple")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(VerifyOtpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    public async Task<ActionResult<VerifyOtpResponse>> SsoApple(
        [FromBody] SsoTokenBody body,
        CancellationToken ct)
    {
        var request = new SsoLoginRequest(Provider: "Apple", IdToken: body.IdToken, AppleFullName: body.FullName);
        var response = await _auth.SsoLoginAsync(request, ClientIp(), UserAgent(), ct);
        return Ok(response);
    }

    // -----------------------------------------------------------------------
    //  helpers
    // -----------------------------------------------------------------------
    private string? ClientIp()
    {
        // Forwarded headers middleware (if configured) rewrites Connection.RemoteIpAddress;
        // falls back to the raw socket address otherwise.
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    private string? UserAgent()
    {
        var ua = HttpContext.Request.Headers.UserAgent.ToString();
        return string.IsNullOrWhiteSpace(ua) ? null : ua;
    }

    private int GetUserId()
    {
        // Default JwtBearer claim mapping aliases 'sub' → ClaimTypes.NameIdentifier.
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated user id claim is missing or malformed.");
        return id;
    }
}

/// <summary>Shared SSO request body — Provider is on the URL (/sso/google or /sso/apple).</summary>
public sealed record SsoTokenBody(string IdToken, string? FullName = null);
