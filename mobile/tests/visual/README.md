# Visual layout review

This runs the actual Expo web app with intercepted local fixture responses: long device/category names, online/offline meters, telemetry and billing summaries. It does not use a real account. External network requests are blocked.

Start Expo with `EXPO_PUBLIC_API_BASE_URL_WEB=http://localhost:8099/api/v1`, on port 8081. With Playwright and Chromium available, run `node tests/visual/run-review.cjs` from `mobile`. Set `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` if they are installed outside the project. No new mobile dependency is required.

The runner checks English and Indonesian at widths 320, 360, 393 and 430 px. It asserts metric alignment/stacking, navbar position, no page overflow and no runtime errors. It captures Week and Custom states in `mobile/coverage/ui-review/`, which is ignored by Git.

For the long-range Home chart regression, run `node tests/visual/run-home-chart-review.cjs` with the same preview and runtime settings. It simulates 10-, 11-, and 30-day months, with zero and nonzero usage, in both languages at widths 320 and 393 px. It checks Month and Custom modes, chart/track dimensions, ancestor visibility after the entrance animation, page overflow, and scrolling to the last day. Screenshots and `home-chart-results.json` are saved in the same ignored output directory. All data comes from local fixtures.

Additional manual browser checks: Day/Month charts, custom calendar, language switching without resetting the selected period, long device names, Online/Offline badges, device detail, history, billing and profile scrolling. Android system bars and font scaling still require a check on the physical APK; a web viewport does not reproduce Android insets.
