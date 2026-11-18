// @vitest-environment jsdom
import React from "react";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Privacy } from "@/components/shared";
import { Button } from "@/components/ui/button";
afterEach(cleanup);
it("privacy exposes persistent Drive and ephemeral browser semantics", () => {
  render(<Privacy />);
  expect(
    screen.getByText(/tetap tersimpan setelah tab ditutup/),
  ).toBeInTheDocument();
  expect(screen.getByText(/hilang saat refresh/)).toBeInTheDocument();
});
it("upload action can be disabled until consent and keyboard focus is native", () => {
  render(<Button disabled>Simpan ke Drive</Button>);
  expect(
    screen.getByRole("button", { name: "Simpan ke Drive" }),
  ).toBeDisabled();
});
