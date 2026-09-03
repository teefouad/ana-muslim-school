import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home", () => {
  it("renders the getting-started heading", () => {
    render(<Home />);

    expect(screen.getByText("file.", { exact: false })).toBeInTheDocument();
  });
});
