import { fireEvent, render, screen } from "@testing-library/react-native";
import CategoryDropdown from "../src/components/CategoryDropdown";

test("opens categories, preserves ids and closes after choosing", () => {
    const onChange = jest.fn();
    render(<CategoryDropdown categories={[{ id: 12, name: "Kitchen" }]}
        value={null} onChange={onChange} emptyLabel="All" label="Category" />);
    expect(screen.queryByText("Kitchen")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Category" }));
    fireEvent.press(screen.getByText("Kitchen"));
    expect(onChange).toHaveBeenCalledWith(12);
    expect(screen.queryByText("Kitchen")).toBeNull();
});

test("supports clearing a category and string ids", () => {
    const onChange = jest.fn();
    render(<CategoryDropdown categories={[{ id: 12, name: "Kitchen" }]}
        value="12" onChange={onChange} emptyLabel="Uncategorized" label="Category" />);
    expect(screen.getByText("Kitchen")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Category" }));
    fireEvent.press(screen.getByText("Uncategorized"));
    expect(onChange).toHaveBeenCalledWith(null);
});
