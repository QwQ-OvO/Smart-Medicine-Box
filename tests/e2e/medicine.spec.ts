import { test, expect, type Page } from "@playwright/test";
test("a previously found package can be reported missing on a later search", async ({
  page,
}) => {
  await add(page);
  await page.getByRole("button", { name: "在这里找到了", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已记录这次找到" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "这里没找到", exact: true }).click();
  await expect(page.getByRole("heading", { name: "这里没找到" })).toBeVisible();
});
test("failed save keeps draft and retry writes one record", async ({
  page,
}) => {
  await page.goto("/record");
  await page.getByRole("button", { name: "直接手工填写" }).click();
  await page.getByLabel("药名", { exact: true }).fill("布洛芬");
  await page.getByLabel("具体位置").fill("书桌");
  await page.getByRole("button", { name: "继续核对" }).click();
  await page.evaluate(async () => {
    const path = "/src/App.tsx";
    const { store } = await import(path);
    let once = true;
    store.db.commands.hook("creating", () => {
      if (once) {
        once = false;
        throw new Error("simulated write failure");
      }
    });
  });
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page.getByRole("alert")).toContainText("保存未完成");
  await expect(page.getByLabel("具体位置")).toHaveValue("书桌");
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page).toHaveURL(/\/clue\//);
  await page.getByRole("button", { name: "查看这盒药的历史" }).click();
  await expect(page.getByText("书桌", { exact: true })).toHaveCount(1);
});
test("photo survives refresh and historical photo is not inherited", async ({
  page,
}, testInfo) => {
  await page.goto("/record");
  await page.getByRole("button", { name: "直接手工填写" }).click();
  await page.getByLabel("药名", { exact: true }).fill("布洛芬");
  await page.getByLabel("具体位置").fill("抽屉");
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (
      ...args: Parameters<typeof createImageBitmap>
    ) => {
      await new Promise((r) => setTimeout(r, 800));
      return original(...args);
    }) as typeof createImageBitmap;
  });
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 40;
    c.getContext("2d")!.fillRect(0, 0, 40, 40);
    return c.toDataURL().split(",")[1];
  });
  await page.getByLabel("选择位置照片").setInputFiles({
    name: "location.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.getByRole("button", { name: "继续核对" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "查看位置照片" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续核对" }).click();
  await page.screenshot({
    path: testInfo.outputPath("review-photo.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page).toHaveURL(/\/clue\//);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "查看位置照片" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("clue-photo.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "这里没找到", exact: true }).click();
  await page.getByRole("button", { name: "在别处找到了，更新位置" }).click();
  await page.getByLabel("找到的位置").fill("柜子");
  await page.getByRole("button", { name: "继续核对" }).click();
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page.getByRole("button", { name: "查看位置照片" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "查看这盒药的历史" }).click();
  await expect(
    page.getByRole("button", { name: "查看位置照片" }),
  ).toBeVisible();
});
test("switching to manual ignores a late parsing response", async ({
  page,
}) => {
  await page.route("**/api/v1/parse-previews", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route
      .fulfill({
        json: {
          data: {
            mode: "mock",
            status: "ready",
            candidate: { medicineName: "错误覆盖", locationText: "旧位置" },
            issues: [],
            missingFields: [],
          },
        },
      })
      .catch(() => {});
  });
  await page.goto("/record");
  await page.getByLabel("你的描述").fill("药放在桌上");
  await page.getByRole("button", { name: "整理为待核对记录" }).click();
  await page.getByRole("button", { name: "直接手工填写" }).click();
  await page.getByLabel("药名", { exact: true }).fill("手工药名");
  await page.waitForTimeout(700);
  await expect(page.getByLabel("药名", { exact: true })).toHaveValue(
    "手工药名",
  );
});
test("mobile layouts remain within viewport and produce review screenshots", async ({
  page,
}, testInfo) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`home-${width}.png`),
      fullPage: true,
    });
  }
});
async function add(page: Page, label = "随身盒", location = "黑色背包前袋") {
  await page.goto("/");
  await page.getByRole("button", { name: "记一个位置", exact: true }).click();
  await page.getByRole("button", { name: "直接手工填写" }).click();
  await page.getByLabel("药名", { exact: true }).fill("布洛芬");
  await page.getByLabel("包装标签", { exact: true }).fill(label);
  await page.getByLabel("具体位置", { exact: true }).fill(location);
  await page.getByRole("button", { name: "继续核对" }).click();
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "位置线索", exact: true }),
  ).toBeVisible();
}
test("manual record survives refresh; miss and correction retain history", async ({
  page,
}) => {
  await add(page);
  await page.reload();
  await expect(page.getByText("黑色背包前袋", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "这里没找到", exact: true }).click();
  await expect(page.getByRole("heading", { name: "这里没找到" })).toBeVisible();
  await page.getByRole("button", { name: "在别处找到了，更新位置" }).click();
  await page.getByLabel("找到的位置").fill("行李箱内侧袋");
  await page.getByRole("button", { name: "继续核对" }).click();
  await page.getByRole("button", { name: "确认并保存", exact: true }).click();
  await expect(page.getByText("行李箱内侧袋", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看这盒药的历史" }).click();
  await expect(page.getByText("本次未找到", { exact: false })).toBeVisible();
  await expect(
    page.getByText("黑色背包前袋", { exact: false }).first(),
  ).toBeVisible();
});
test("same-name packaging stays separate and unknown search is not inventory zero", async ({
  page,
}) => {
  await add(page);
  await add(page, "家用盒", "药箱上层");
  await page.goto("/");
  await page.getByLabel("要找的药名").fill("布洛芬");
  await page.getByRole("button", { name: "查找位置", exact: true }).click();
  await expect(page.getByRole("heading", { name: "选择哪一盒" })).toBeVisible();
  await page.getByRole("button", { name: "布洛芬 · 家用盒" }).click();
  await expect(page.getByText("药箱上层", { exact: true })).toBeVisible();
  await page.goto("/");
  await page.getByLabel("要找的药名").fill("不存在");
  await page.getByRole("button", { name: "查找位置", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "暂无位置线索" }),
  ).toBeVisible();
});
test("mock parsing is labelled and requires review", async ({ page }) => {
  await page.goto("/record");
  await page.getByLabel("你的描述").fill("这盒布洛芬放在黑色背包前袋");
  await expect(page.getByText(/演示解析/)).toBeVisible();
  await page.getByRole("button", { name: "整理为待核对记录" }).click();
  await expect(
    page.getByRole("heading", { name: "核对这条线索" }),
  ).toBeVisible();
  await expect(page.getByLabel("药名", { exact: true })).toHaveValue("布洛芬");
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page.getByText(/演示解析后确认/)).toBeVisible();
});
test("parse failure retains source and permits manual entry", async ({
  page,
}) => {
  await page.route("**/api/v1/parse-previews", (route) =>
    route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "PARSE_TIMEOUT" },
        requestId: "test",
      }),
    }),
  );
  await page.goto("/record");
  await page.getByLabel("你的描述").fill("这盒药放在书桌上");
  await page.getByRole("button", { name: "整理为待核对记录" }).click();
  await expect(
    page.getByRole("heading", { name: "暂时无法整理" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "改为手工填写" }).click();
  await expect(
    page.getByText("这盒药放在书桌上", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("药名", { exact: true }).fill("布洛芬");
  await page.getByLabel("具体位置").fill("书桌");
  await page.getByRole("button", { name: "继续核对" }).click();
  await page.getByRole("button", { name: "确认并保存" }).click();
  await expect(page.getByText("书桌", { exact: true })).toBeVisible();
});
