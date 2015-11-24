
# API

**Warning: This API is constantly evolving**

## Format

All requests/responses are in JSON.

### Response

#### Successful

Depends on endpoint

#### Failed

```json
{
  "error": "Short error message",
  "status": 1,
  "message": "Full error message"
}
```

## Endpoints

### /plan

Endpoint | Description
------------- | -------------
GET /plan | All entries from today on

### /classes

Endpoint | Description
------------- | -------------
GET /classes | All classes in the DB
GET /classes/:class | Get info for class

### /days

Endpoint | Description
------------- | -------------
GET /days | All days in the DB
GET /days/:day | Get info for day

## JSONP

TODO
