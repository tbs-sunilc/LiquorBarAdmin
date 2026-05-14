using System.Net;
using System.Text.Json;
using FluentValidation;
using SipSave.Application.Exceptions;

namespace SipSave.API.Middleware;

public class GlobalExceptionMiddleware
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException vex)
        {
            _logger.LogWarning(vex, "Validation failed on {Path}", context.Request.Path);
            await WriteProblem(context, HttpStatusCode.BadRequest, "Validation failed",
                errors: vex.Errors.Select(e => new { e.PropertyName, e.ErrorMessage }));
        }
        catch (InvalidOtpException iex)
        {
            _logger.LogWarning("OTP verification failed on {Path}: {Reason}", context.Request.Path, iex.Details.Reason);
            var status = (HttpStatusCode)iex.SuggestedHttpStatus;
            var title = iex.Details.Reason switch
            {
                "Locked"      => "Account temporarily locked",
                "OtpExpired"  => "OTP expired",
                "NotFound"    => "OTP not found for this mobile number",
                _             => "Invalid OTP"
            };
            await WriteProblem(context, status, title,
                extensions: new Dictionary<string, object?> { ["otp"] = iex.Details });
        }
        catch (OtpRateLimitExceededException rex)
        {
            _logger.LogInformation("OTP send rate limit exceeded (retry after {RetryAfter:u})", rex.RetryAfterUtc);
            var retryAfterSeconds = (int)Math.Max(1, Math.Ceiling((rex.RetryAfterUtc - DateTime.UtcNow).TotalSeconds));
            context.Response.Headers["Retry-After"] = retryAfterSeconds.ToString();
            await WriteProblem(context, HttpStatusCode.TooManyRequests,
                "OTP send rate limit exceeded",
                extensions: new Dictionary<string, object?>
                {
                    ["retryAfterSeconds"] = retryAfterSeconds,
                    ["retryAfterUtc"] = rex.RetryAfterUtc
                });
        }
        catch (SmsDeliveryException sex)
        {
            _logger.LogError(sex, "SMS provider failure: Provider={Provider} Code={Code}", sex.Provider, sex.ProviderErrorCode);
            await WriteProblem(context, HttpStatusCode.BadGateway,
                "Unable to send OTP — please try again");
        }
        catch (NotImplementedException nix)
        {
            _logger.LogWarning(nix, "Endpoint not implemented on {Path}", context.Request.Path);
            await WriteProblem(context, HttpStatusCode.NotImplemented, "Not implemented");
        }
        catch (InsufficientWalletBalanceException ibx)
        {
            _logger.LogInformation("Pour refused on {Path}: wallet {Wallet} has {Remaining} ml, requested {Requested} ml",
                context.Request.Path, ibx.WalletId, ibx.RemainingMl, ibx.RequestedMl);
            await WriteProblem(context, HttpStatusCode.UnprocessableEntity,
                "Insufficient wallet balance",
                extensions: new Dictionary<string, object?>
                {
                    ["wallet"] = new
                    {
                        walletId    = ibx.WalletId,
                        requestedMl = ibx.RequestedMl,
                        remainingMl = ibx.RemainingMl
                    }
                });
        }
        catch (DryDayBlockedException dry)
        {
            _logger.LogInformation("Dry-day block on {Path}: state={State} date={Date}",
                context.Request.Path, dry.StateCode, dry.DryDate);
            await WriteProblem(context, HttpStatusCode.Locked,
                "Purchases Unavailable Today",
                extensions: new Dictionary<string, object?>
                {
                    ["dryDay"] = new
                    {
                        stateCode            = dry.StateCode,
                        dryDate              = dry.DryDate.ToString("yyyy-MM-dd"),
                        title                = dry.DryDayTitle,
                        nextAvailableAtLocal = dry.NextAvailableAtLocal?.ToString("o")
                    }
                });
        }
        catch (PaymentVerificationException pvx)
        {
            _logger.LogWarning("Payment verification failed on {Path}: {Reason}", context.Request.Path, pvx.ReasonCode);
            await WriteProblem(context, HttpStatusCode.BadRequest, "Payment verification failed",
                extensions: new Dictionary<string, object?>
                {
                    ["payment"] = new { reasonCode = pvx.ReasonCode }
                });
        }
        catch (UnauthorizedAccessException uex)
        {
            _logger.LogWarning(uex, "Unauthorized access on {Path}", context.Request.Path);
            await WriteProblem(context, HttpStatusCode.Unauthorized, "Unauthorized");
        }
        catch (KeyNotFoundException knf)
        {
            _logger.LogInformation(knf, "Resource not found on {Path}", context.Request.Path);
            await WriteProblem(context, HttpStatusCode.NotFound, "Resource not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);
            await WriteProblem(context, HttpStatusCode.InternalServerError,
                _env.IsDevelopment() ? ex.Message : "An unexpected error occurred.");
        }
    }

    private static Task WriteProblem(
        HttpContext context,
        HttpStatusCode status,
        string title,
        object? errors = null,
        IDictionary<string, object?>? extensions = null)
    {
        var payload = new Dictionary<string, object?>
        {
            ["type"]    = $"https://httpstatuses.io/{(int)status}",
            ["title"]   = title,
            ["status"]  = (int)status,
            ["traceId"] = context.TraceIdentifier
        };
        if (errors is not null) payload["errors"] = errors;
        if (extensions is not null)
            foreach (var kvp in extensions)
                payload[kvp.Key] = kvp.Value;

        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/problem+json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
    }
}
