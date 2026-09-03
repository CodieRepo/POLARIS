import https from "https";
import http from "http";

export interface HttpResponse {
  ok: boolean;
  statusCode: number;
  data: string;
}

/**
 * Universal Resilient HTTP Client with explicit socket timeout and zero hanging promises
 */
export function fetchWithTimeout(url: string, timeoutMs: number = 3000): Promise<HttpResponse> {
  return new Promise((resolve) => {
    try {
      const isHttps = url.startsWith("https:");
      const client = isHttps ? https : http;

      const req = client.get(
        url,
        {
          rejectUnauthorized: false,
          timeout: timeoutMs,
          headers: {
            "User-Agent": "POLARIS-Polar-Command-Suite/1.0 (NCPOR-MoES-SIH2026)",
            Accept: "text/html,application/json,*/*",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
              statusCode: res.statusCode ?? 500,
              data,
            });
          });
        }
      );

      req.on("error", () => {
        resolve({ ok: false, statusCode: 500, data: "" });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, statusCode: 504, data: "" });
      });
    } catch {
      resolve({ ok: false, statusCode: 500, data: "" });
    }
  });
}
