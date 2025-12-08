import { NextRequest, NextResponse } from "next/server";

/**
 * CouchDB Proxy API Route
 * Proxies CouchDB requests server-side to avoid mixed content issues
 * Browser makes HTTPS request to this API, server makes HTTP request to CouchDB
 *
 * Usage: /api/couchdb-proxy/{database}/{path}
 * Example: /api/couchdb-proxy/shop_xxx_products/_all_docs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams, "DELETE");
}

async function handleProxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
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
      // Fallback to env vars or query params
      username =
        request.nextUrl.searchParams.get("username") ||
        process.env.NEXT_PUBLIC_COUCHDB_USERNAME ||
        "admin";
      password =
        request.nextUrl.searchParams.get("password") ||
        process.env.NEXT_PUBLIC_COUCHDB_PASSWORD ||
        "secret";
    }

    const authHeader = request.headers.get("authorization");

    // Build CouchDB path from route params
    // Format: [database, ...rest-of-path] or just [database]
    // Example: ["shop_xxx_products", "_all_docs"] -> shop_xxx_products/_all_docs
    const couchdbPath = params.path.join("/");
    const targetUrl = `${cleanUrl}/${couchdbPath}`;

    console.log(`[CouchDB Proxy] ${method} ${couchdbPath} -> ${targetUrl}`);

    // Forward query string (except auth params)
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
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
