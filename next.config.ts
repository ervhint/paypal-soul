import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets a phone on the same Wi-Fi use `next dev`. Set DEV_ORIGIN to the laptop's IP in .env.local.
  allowedDevOrigins: process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : [],
};

export default config;
