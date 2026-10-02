import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

describe("Button", () => {
  it("runs onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continue</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("while loading it is disabled, marked busy, and a second click does nothing (no double submit)", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Pay
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Pay/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    await userEvent.dblClick(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("a disabled button does not fire", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild gives a link the button's look without nesting a button inside a link", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/design">Style guide</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Style guide" });
    expect(link).toHaveAttribute("href", "/design");
    expect(link.className).toContain("border-line-strong");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is a plain button by default so it never submits a form by accident... unless it is a submit", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Save</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("Input", () => {
  it("marks itself invalid for assistive technology", () => {
    render(<Input aria-label="Email" invalid />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
  it("is not marked invalid by default", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });
});

describe("Field", () => {
  const renderField = (props: { hint?: string; error?: string }) =>
    render(
      <Field label="Email" {...props}>
        {({ invalid, ...control }) => <Input invalid={invalid} {...control} />}
      </Field>,
    );

  it("connects the label to the input (clicking the label focuses it)", async () => {
    renderField({});
    await userEvent.click(screen.getByText("Email"));
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("shows the hint and links it to the input", () => {
    renderField({ hint: "We email your receipt here." });
    const hint = screen.getByText("We email your receipt here.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-describedby", hint.id);
  });

  it("an error is announced (role=alert), links to the input, marks it invalid and replaces the hint", () => {
    renderField({ hint: "We email your receipt here.", error: "Enter a valid email address" });
    const input = screen.getByLabelText("Email");
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Enter a valid email address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
    expect(screen.queryByText("We email your receipt here.")).toBeNull();
  });

  it("no error, no alert", () => {
    renderField({});
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });

  it("two fields on a page never share an id", () => {
    render(
      <>
        <Field label="First">{(c) => <Input id={c.id} />}</Field>
        <Field label="Second">{(c) => <Input id={c.id} />}</Field>
      </>,
    );
    expect(screen.getByLabelText("First").id).not.toBe(screen.getByLabelText("Second").id);
  });
});

describe("Badge", () => {
  it("renders its text", () => {
    render(<Badge tone="leaf">Confirmed</Badge>);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });
});
