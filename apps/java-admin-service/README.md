# Java admin extension skeleton

This module intentionally exposes only Spring Boot health endpoints, for example `GET /actuator/health`.

It does not implement authentication, write to the shared MySQL schema, or own any business flow in Sprint 1. Node.js is the single runtime and write owner for authentication.
