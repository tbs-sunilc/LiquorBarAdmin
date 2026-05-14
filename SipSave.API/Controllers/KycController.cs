using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SipSave.Application.DTOs.Kyc;
using SipSave.Application.Interfaces;

namespace SipSave.API.Controllers;

/// <summary>
/// Endpoints for Section 3 Module A — KYC. Two-step upload flow (presign → direct
/// R2 PUT → submit) keeps the document bytes off the API tier. Admin review
/// endpoints are gated by role "Admin" — the access-token's <c>sub</c> claim
/// references <c>AdminUsers.Id</c> rather than <c>Users.Id</c> on those routes.
/// </summary>
[ApiController]
[Route("api/v1/kyc")]
[Produces("application/json")]
public sealed class KycController : ControllerBase
{
    private const string AdminRole = "Admin";

    private readonly IKycService _kyc;

    public KycController(IKycService kyc)
    {
        _kyc = kyc;
    }

    // =========================================================================
    //  End-user endpoints
    // =========================================================================

    /// <summary>POST /api/v1/kyc/presign — get a short-lived R2 PUT URL for the SC-07 upload.</summary>
    [HttpPost("presign")]
    [Authorize]
    [ProducesResponseType(typeof(KycPresignedUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<KycPresignedUrlResponse>> Presign(
        [FromBody] KycPresignedUrlRequest request,
        CancellationToken ct)
    {
        var response = await _kyc.GetUploadUrlAsync(request, GetSubId(), ct);
        return Ok(response);
    }

    /// <summary>POST /api/v1/kyc/submit — confirm client R2 upload completed; flip to PendingReview.</summary>
    [HttpPost("submit")]
    [Authorize]
    [ProducesResponseType(typeof(KycStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<KycStatusResponse>> Submit(
        [FromBody] KycSubmitRequest request,
        CancellationToken ct)
    {
        var response = await _kyc.SubmitAsync(request, GetSubId(), ct);
        return Ok(response);
    }

    /// <summary>GET /api/v1/kyc/status — drives the SC-08 progress board and SC-09 rejection screen.</summary>
    [HttpGet("status")]
    [Authorize]
    [ProducesResponseType(typeof(KycStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KycStatusResponse>> Status(CancellationToken ct)
    {
        var response = await _kyc.GetStatusAsync(GetSubId(), ct);
        return Ok(response);
    }

    // =========================================================================
    //  Admin endpoints
    // =========================================================================

    /// <summary>GET /api/v1/kyc/{userId}/status — admin detail incl. signed document URL.</summary>
    [HttpGet("{userId:int}/status")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(typeof(KycStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KycStatusResponse>> StatusForAdmin(int userId, CancellationToken ct)
    {
        var response = await _kyc.GetStatusForAdminAsync(userId, GetSubId(), ct);
        return Ok(response);
    }

    /// <summary>PUT /api/v1/kyc/{userId}/approve — admin approval; stamps DOB + emits KycApproved notifications.</summary>
    [HttpPut("{userId:int}/approve")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(typeof(KycStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KycStatusResponse>> Approve(
        int userId,
        [FromBody] KycApproveRequest request,
        CancellationToken ct)
    {
        var response = await _kyc.ApproveAsync(userId, request, GetSubId(), ct);
        return Ok(response);
    }

    /// <summary>
    /// PUT /api/v1/kyc/{userId}/reject — admin rejection. When
    /// <see cref="KycRejectRequest.IsPermanentRejection"/> is true, BR-004 under-18
    /// permanent ban is applied and the user's DateOfBirth is stamped so future
    /// submissions are blocked at the SC-07 gate.
    /// </summary>
    [HttpPut("{userId:int}/reject")]
    [Authorize(Roles = AdminRole)]
    [ProducesResponseType(typeof(KycStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<KycStatusResponse>> Reject(
        int userId,
        [FromBody] KycRejectRequest request,
        CancellationToken ct)
    {
        var response = await _kyc.RejectAsync(userId, request, GetSubId(), ct);
        return Ok(response);
    }

    // -----------------------------------------------------------------------
    //  helpers
    // -----------------------------------------------------------------------
    private int GetSubId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub");
        if (!int.TryParse(sub, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            throw new UnauthorizedAccessException("Authenticated principal 'sub' claim is missing or malformed.");
        return id;
    }
}
