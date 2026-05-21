import { env } from "@/lib/env";
import { footballDataProvider } from "./football-data";
import type { FootballDataProvider } from "./types";

export function getFootballProvider(): FootballDataProvider {
  switch (env.footballProvider) {
    case "football-data":
      return footballDataProvider;
    case "api-football":
      throw new Error(
        "Proveedor api-football aún no implementado; usa football-data",
      );
    default:
      return footballDataProvider;
  }
}
