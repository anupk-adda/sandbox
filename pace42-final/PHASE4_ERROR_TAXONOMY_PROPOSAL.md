# Phase 4: Error Taxonomy Proposal

## Overview
Standardize error codes and response shapes across backend API and agent-service for consistent error handling and debugging.

---

## 1. Error Code Taxonomy

### Authentication Errors (AUTH_*)
- `AUTH_INVALID_TOKEN` - JWT token is malformed or invalid
- `AUTH_EXPIRED_TOKEN` - JWT token has expired
- `AUTH_MISSING_TOKEN` - No authentication token provided
- `AUTH_INVALID_CREDENTIALS` - Username/password incorrect
- `AUTH_USER_NOT_FOUND` - User does not exist
- `AUTH_SESSION_EXPIRED` - Session has expired

### Validation Errors (VALIDATION_*)
- `VALIDATION_ERROR` - Generic validation failure
- `VALIDATION_MISSING_FIELD` - Required field missing
- `VALIDATION_INVALID_FORMAT` - Field format invalid
- `VALIDATION_OUT_OF_RANGE` - Value outside acceptable range

### Garmin Integration Errors (GARMIN_*)
- `GARMIN_CONNECT_FAILED` - Failed to connect to Garmin API
- `GARMIN_AUTH_FAILED` - Garmin authentication failed
- `GARMIN_INVALID_CREDENTIALS` - Garmin username/password incorrect
- `GARMIN_API_ERROR` - Garmin API returned error
- `GARMIN_RATE_LIMITED` - Garmin API rate limit exceeded
- `GARMIN_NO_DATA` - No data available from Garmin

### Subscription Errors (SUBSCRIPTION_*)
- `SUBSCRIPTION_PLAN_LIMIT` - Training plan limit reached
- `SUBSCRIPTION_QUERY_LIMIT` - Monthly query limit reached
- `SUBSCRIPTION_TIER_REQUIRED` - Feature requires higher tier
- `SUBSCRIPTION_UPGRADE_FAILED` - Upgrade operation failed
- `SUBSCRIPTION_INVALID_TIER` - Invalid subscription tier specified

### Rate Limiting Errors (RATE_*)
- `RATE_LIMITED` - Generic rate limit exceeded
- `RATE_LIMIT_QUERY` - Query rate limit exceeded
- `RATE_LIMIT_API` - API rate limit exceeded

### Resource Errors (RESOURCE_*)
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RESOURCE_ALREADY_EXISTS` - Resource already exists
- `RESOURCE_CONFLICT` - Resource state conflict

### Agent/AI Errors (AGENT_*)
- `AGENT_PROCESSING_FAILED` - Agent failed to process request
- `AGENT_TIMEOUT` - Agent processing timeout
- `AGENT_INVALID_RESPONSE` - Agent returned invalid response
- `AGENT_SERVICE_UNAVAILABLE` - Agent service not available

### Internal Errors (INTERNAL_*)
- `INTERNAL_ERROR` - Generic internal server error
- `INTERNAL_DATABASE_ERROR` - Database operation failed
- `INTERNAL_SERVICE_ERROR` - Internal service error

---

## 2. Standardized Error Response Shape

### Response Format
```typescript
{
  error: {
    code: string;           // Error code from taxonomy
    message: string;        // Human-readable error message
    statusCode: number;     // HTTP status code
    requestId: string;      // Request correlation ID
    details?: any;          // Optional additional context
    upgradeRequired?: boolean;  // For subscription errors
  }
}
```

### Examples

**Authentication Error:**
```json
{
  "error": {
    "code": "AUTH_EXPIRED_TOKEN",
    "message": "Your session has expired. Please log in again.",
    "statusCode": 401,
    "requestId": "req_abc123xyz"
  }
}
```

**Subscription Error:**
```json
{
  "error": {
    "code": "SUBSCRIPTION_QUERY_LIMIT",
    "message": "Monthly query limit reached. Upgrade to Premium for unlimited queries.",
    "statusCode": 429,
    "requestId": "req_def456uvw",
    "details": {
      "tier": "free",
      "limit": 50,
      "remaining": 0
    },
    "upgradeRequired": true
  }
}
```

**Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_MISSING_FIELD",
    "message": "Required field 'goalDistance' is missing.",
    "statusCode": 400,
    "requestId": "req_ghi789rst",
    "details": {
      "field": "goalDistance",
      "required": true
    }
  }
}
```

---

## 3. Implementation Strategy

### Phase 4.1: Backend Error Handler Enhancement

**File:** `backend/src/middleware/error-handler.ts`

**Changes:**
1. Create `ApiError` class with error code support
2. Add request ID middleware
3. Standardize error response formatting
4. Map existing errors to new codes

**Implementation:**
```typescript
// New ApiError class
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Error handler middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.id || 'unknown';
  
  // Handle ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        requestId,
        details: err.details
      }
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid authentication token',
        statusCode: 401,
        requestId
      }
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'AUTH_EXPIRED_TOKEN',
        message: 'Authentication token has expired',
        statusCode: 401,
        requestId
      }
    });
  }
  
  // Default internal error
  logger.error('Unhandled error', { error: err, requestId });
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      statusCode: 500,
      requestId
    }
  });
};
```

### Phase 4.2: Request ID Middleware

**File:** `backend/src/middleware/request-id.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};
```

### Phase 4.3: Update Existing Error Throws

**Files to Update:**
1. `backend/src/routes/auth.routes.ts`
   - Replace generic errors with `ApiError`
   - Use `AUTH_INVALID_CREDENTIALS`, `AUTH_USER_NOT_FOUND`

2. `backend/src/routes/training-plan.routes.ts`
   - Already uses subscription errors (keep existing)
   - Add `RESOURCE_NOT_FOUND` for missing plans

3. `backend/src/routes/chat.routes.ts`
   - Add `VALIDATION_MISSING_FIELD` for missing message
   - Keep existing subscription error handling

4. `backend/src/routes/garmin.routes.ts`
   - Use `GARMIN_CONNECT_FAILED`, `GARMIN_AUTH_FAILED`
   - Add `GARMIN_INVALID_CREDENTIALS`

5. `backend/src/services/garmin-service.ts`
   - Throw `ApiError` with Garmin error codes
   - Map Garmin API errors to taxonomy

### Phase 4.4: Agent Service Alignment

**File:** `agent-service/src/main.py`

**Changes:**
1. Standardize error response format
2. Use same error codes where applicable
3. Include requestId in responses

**Implementation:**
```python
# Error response helper
def error_response(code: str, message: str, status_code: int, request_id: str, details: dict = None):
    return {
        "error": {
            "code": code,
            "message": message,
            "statusCode": status_code,
            "requestId": request_id,
            "details": details
        }
    }, status_code

# Example usage
@app.route('/analyze', methods=['POST'])
def analyze():
    request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    
    try:
        # Processing logic
        pass
    except Exception as e:
        logger.error(f"Analysis failed: {e}", extra={"requestId": request_id})
        return error_response(
            code="AGENT_PROCESSING_FAILED",
            message="Failed to analyze running data",
            status_code=500,
            request_id=request_id,
            details={"error": str(e)}
        )
```

---

## 4. Minimal Changeset

### New Files (2)
1. `backend/src/middleware/request-id.ts` - Request ID middleware
2. `backend/src/utils/api-error.ts` - ApiError class

### Modified Files (8)
1. `backend/src/middleware/error-handler.ts` - Standardize error responses
2. `backend/src/server.ts` - Add request ID middleware
3. `backend/src/routes/auth.routes.ts` - Use ApiError for auth errors
4. `backend/src/routes/training-plan.routes.ts` - Add resource errors
5. `backend/src/routes/chat.routes.ts` - Add validation errors
6. `backend/src/routes/garmin.routes.ts` - Use Garmin error codes
7. `backend/src/services/garmin-service.ts` - Throw ApiError
8. `agent-service/src/main.py` - Align error response format

### Existing Files (No Changes Required)
- `backend/src/middleware/subscription-check.ts` - Already uses correct format
- `backend/src/utils/subscription-errors.ts` - Already defines error codes

---

## 5. Implementation Order

### Step 1: Foundation (30 min)
- Create `api-error.ts` with ApiError class
- Create `request-id.ts` middleware
- Update `server.ts` to use request ID middleware

### Step 2: Error Handler (30 min)
- Update `error-handler.ts` with new format
- Add error code mapping for common errors
- Test with existing endpoints

### Step 3: Route Updates (60 min)
- Update auth routes (15 min)
- Update training plan routes (15 min)
- Update chat routes (15 min)
- Update Garmin routes (15 min)

### Step 4: Service Updates (30 min)
- Update garmin-service.ts
- Update agent-service main.py

### Step 5: Testing (30 min)
- Test all error scenarios
- Verify error codes and formats
- Check request ID propagation

**Total Estimated Time:** 3 hours

---

## 6. Acceptance Criteria

- [ ] All API errors include `error.code` from taxonomy
- [ ] All API errors include `requestId`
- [ ] Error response shape is consistent across all endpoints
- [ ] Authentication errors use `AUTH_*` codes
- [ ] Subscription errors use `SUBSCRIPTION_*` codes
- [ ] Garmin errors use `GARMIN_*` codes
- [ ] Agent service errors align with backend format
- [ ] Request ID propagates from backend to agent service
- [ ] No PII (passwords, tokens) in error responses
- [ ] Error messages are user-friendly

---

## 7. Testing Plan

### Unit Tests
- Test ApiError class creation
- Test error handler middleware with different error types
- Test request ID middleware

### Integration Tests
- Test auth error responses (invalid credentials, expired token)
- Test subscription error responses (plan limit, query limit)
- Test Garmin error responses (connection failed, auth failed)
- Test validation error responses (missing fields)

### Manual Tests
- Trigger each error code manually
- Verify error response format
- Check request ID in logs and responses
- Verify error messages are user-friendly

---

## 8. Rollback Plan

If issues arise:
1. Revert `error-handler.ts` to previous version
2. Remove request ID middleware from `server.ts`
3. Revert route changes one by one
4. Keep subscription errors (already working)

---

## 9. Future Enhancements (Post-Phase 4)

- Add error code documentation endpoint (`GET /api/v1/errors`)
- Create error code reference in frontend
- Add error analytics/tracking
- Implement retry logic for transient errors
- Add circuit breaker for external services
