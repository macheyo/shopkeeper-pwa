"use client"; // This component interacts with browser APIs (camera, DOM)

import React, { useRef, useEffect, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Loader, Alert, Text } from "@mantine/core";
import { IconAlertCircle, IconCameraOff } from "@tabler/icons-react";

interface BarcodeScannerProps {
  onScan: (text: string) => void;
  onError?: (error: Error) => void; // Optional error handler
}

export default function BarcodeScanner({
  onScan,
  onError,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    let isMounted = true;

    const startScan = async () => {
      if (!videoRef.current || !isMounted) return;

      setLoading(true);
      setError(null);

      try {
        // Ensure permissions are granted before trying to decode
        // This might prompt the user if not already granted
        await navigator.mediaDevices.getUserMedia({ video: true });

        console.log("Starting barcode scan...");
        controlsRef.current = await codeReader.decodeFromVideoDevice(
          undefined, // Use default device
          videoRef.current,
          (result, err, controls) => {
            if (!isMounted) {
              controls.stop();
              return;
            }
            setLoading(false); // Stop loading once stream starts or fails initially

            if (result) {
              console.log("Barcode detected:", result.getText());
              onScan(result.getText());
              // Optional: Stop scanning after first successful scan?
              // controls.stop();
            }

            if (err) {
              // Ignore NotFoundException, it happens constantly between scans
              if (err.name !== "NotFoundException") {
                console.error("Scan Error:", err);
                const errorMessage = `Scan Error: ${err.name} - ${err.message}`;
                setError(errorMessage);
                if (onError) {
                  onError(err);
                }
              }
            }
          }
        );
        console.log("Barcode scanner controls initialized.");
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error("Error initializing scanner:", err);
        let errorMessage = "Failed to initialize scanner.";
        if (err instanceof Error) {
          errorMessage += ` Error: ${err.name} - ${err.message}`;
          if (err.name === "NotAllowedError") {
            errorMessage =
              "Camera permission denied. Please grant permission in your browser settings.";
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            errorMessage =
              "No camera found. Please ensure a camera is connected and enabled.";
          }
        } else {
          errorMessage += ` Unknown error: ${String(err)}`;
        }
        setError(errorMessage);
        if (onError && err instanceof Error) {
          onError(err);
        } else if (onError) {
          onError(new Error(String(err)));
        }
        setLoading(false);
      }
    };

    startScan();

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Stopping barcode scanner...");
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
        console.log("Scanner stopped.");
      }
    };
    // Rerun effect if onScan or onError changes (though unlikely for onScan)
  }, [onScan, onError]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "500px",
        margin: "auto",
      }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Loader />
          <Text>Starting camera...</Text>
        </div>
      )}
      {error && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Scanner Error"
          color="red"
          mb="md"
        >
          {error}
        </Alert>
      )}
      {/* Video element for the camera stream */}
      <video
        ref={videoRef}
        style={{
          width: "100%",
          height: "auto",
          border: error ? "2px solid red" : "1px solid grey",
          display: loading && !error ? "none" : "block", // Hide video while loading unless there's an error
        }}
        // Add placeholder if no camera found or permission denied
        // This requires more complex state management based on specific errors
        // For now, the error message serves this purpose.
      />
      {!loading && !error && (
        <Text size="sm" ta="center" mt="xs">
          Point camera at barcode
        </Text>
      )}
      {/* Example of showing icon if camera fails fundamentally */}
      {error &&
        (error.includes("No camera found") ||
          error.includes("permission denied")) && (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IconCameraOff size={48} color="gray" />
            <Text color="dimmed">Camera unavailable</Text>
          </div>
        )}
    </div>
  );
}
