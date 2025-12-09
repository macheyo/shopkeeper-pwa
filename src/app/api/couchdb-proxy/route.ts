import { NextRequest, NextResponse } from "next/server";

/**
 * CouchDB Proxy API Route - Root Handler
 * Handles requests to /api/couchdb-proxy (without path)
 * This is used by PouchDB to get CouchDB server info
 */

async function handleRootProxyRequest(request: NextRequest, method: string) {
  try {
    // Get CouchDB URL from environment variable
    const couchdbUrl =
      process.env.NEXT_PUBLIC_COUCHDB_URL || "http://localhost:5984";
    const cleanUrl = couchdbUrl.replace(/\/$/, "");

    // Get auth from custom header (set by PouchDB custom fetch) or fallback to env vars
    const credentialsHeader = request.headers.get("x-couchdb-credentials");
    let username: string;
    let password: string;

    if (credentialsHeader) {
      // Decode credentials from header (base64 encoded "username:password")
      try {
        const decoded = atob(credentialsHeader);
        [username, password] = decoded.split(":");
      } catch {
        // Fallback to env vars if decoding fails
        username = process.env.NEXT_PUBLIC_COUCHDB_USERNAME || "admin";
        password = process.env.NEXT_PUBLIC_COUCHDB_PASSWORD || "secret";
      }
    } else {
      // Fallback to env vars
      username = process.env.NEXT_PUBLIC_COUCHDB_USERNAME || "admin";
      password = process.env.NEXT_PUBLIC_COUCHDB_PASSWORD || "secret";
    }

    const authHeader = request.headers.get("authorization");

    // Target is CouchDB root
    const targetUrl = cleanUrl;

    console.log(`[CouchDB Proxy] ${method} (root) -> ${targetUrl}`);

    // Forward query string
    const searchParams = new URLSearchParams();
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "username" && key !== "password") {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    // Prepare headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Use auth header if provided, otherwise use credentials from header/env
    if (authHeader) {
      headers["Authorization"] = authHeader;
    } else {
      // Basic auth using credentials we extracted
      const credentials = btoa(`${username}:${password}`);
      headers["Authorization"] = `Basic ${credentials}`;
    }

    // Get request body for POST/PUT
    const body =
      method !== "GET" && method !== "DELETE"
        ? await request.text()
        : undefined;

    // Make the proxied request to CouchDB (server-side, so HTTP is OK)
    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
    });

    const data = await response.text();

    // Forward the response with CORS headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-CouchDB-Credentials",
      },
    });
  } catch (error) {
    console.error("CouchDB proxy error:", error);
    return NextResponse.json(
      {
        error: "Proxy request failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRootProxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleRootProxyRequest(request, "POST");
}

export async function PUT(request: NextRequest) {
  return handleRootProxyRequest(request, "PUT");
}

export async function DELETE(request: NextRequest) {
  return handleRootProxyRequest(request, "DELETE");
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-CouchDB-Credentials",
    },
  });
}
