import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("unit test environment", () => {
  it("renders React content in jsdom", () => {
    render(<h1>SupaBoard</h1>);

    expect(
      screen.getByRole("heading", { level: 1, name: "SupaBoard" }),
    ).toBeInTheDocument();
  });
});
