import { describe, expect, it } from "vitest";

import {
	createThemeSearchParams,
	getStoredTheme,
	getThemeFromSearch,
	isThemeName,
	mergeThemeQueryParams,
	resolveTheme,
	THEME_STORAGE_KEY,
	withThemeSearch,
} from "../../src/lib/theme";

describe("theme helpers", () => {
	it("recognizes valid themes only", () => {
		expect(isThemeName("default")).toBe(true);
		expect(isThemeName("academy")).toBe(true);
		expect(isThemeName("dark")).toBe(false);
		expect(isThemeName(null)).toBe(false);
	});

	it("reads theme from query string", () => {
		expect(getThemeFromSearch("?theme=academy")).toBe("academy");
		expect(getThemeFromSearch("?theme=default")).toBe("default");
		expect(getThemeFromSearch("?theme=unknown")).toBe(null);
	});

	it("falls back to storage then default", () => {
		const storage = {
			getItem: (key: string) => (key === THEME_STORAGE_KEY ? "academy" : null),
		} as Pick<Storage, "getItem">;

		expect(getStoredTheme(storage)).toBe("academy");
		expect(resolveTheme("", storage)).toBe("academy");
		expect(resolveTheme("?theme=default", storage)).toBe("default");
	});

	it("builds theme search params without dropping existing ones", () => {
		const params = createThemeSearchParams("?page=2", "academy");
		expect(params.get("page")).toBe("2");
		expect(params.get("theme")).toBe("academy");
	});

	it("preserves unrelated params while applying academy theme", () => {
		const params = mergeThemeQueryParams(
			"?page=2&tab=posts",
			{ q: "han" },
			"academy",
		);

		expect(params.get("page")).toBe("2");
		expect(params.get("tab")).toBe("posts");
		expect(params.get("q")).toBe("han");
		expect(params.get("theme")).toBe("academy");
	});

	it("removes theme key when switching to default", () => {
		const params = mergeThemeQueryParams(
			"?theme=academy&page=2",
			{ q: "han" },
			"default",
		);

		expect(params.get("theme")).toBe(null);
		expect(params.get("page")).toBe("2");
		expect(params.get("q")).toBe("han");
	});

	it("is idempotent when repeatedly applying academy", () => {
		const first = mergeThemeQueryParams("?page=2", { q: "han" }, "academy");
		const second = mergeThemeQueryParams(first, { q: "han" }, "academy");

		expect(second.getAll("theme")).toEqual(["academy"]);
		expect(second.get("page")).toBe("2");
		expect(second.get("q")).toBe("han");
	});

	it("keeps hash fragment unchanged when theme is default", () => {
		expect(withThemeSearch("/wiki/history#timeline", "default")).toBe(
			"/wiki/history#timeline",
		);
	});
});
