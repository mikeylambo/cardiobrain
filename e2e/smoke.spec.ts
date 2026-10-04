import { expect, test } from "@playwright/test";

const modes = ["Numbers","Switch","React","Recall"];

test.describe("CardioBrain mobile smoke",()=>{
  test("can play and save a session in every mode",async({page})=>{
    await page.goto("/");
    await expect(page.getByText("Start session")).toBeVisible();

    for(const mode of modes){
      await page.getByText("Start session").click();
      await expect(page.getByText("SESSION SETUP")).toBeVisible();
      await page.getByRole("button",{name:mode,exact:true}).click();
      await page.getByRole("button",{name:"10 MIN",exact:true}).click();
      await page.getByText("Continue to countdown").click();
      await expect(page.getByText("GO")).toBeVisible({timeout:6000});
      await page.waitForTimeout(400);

      for(let i=0;i<3;i++){
        const pads=page.locator(".answer-pad");
        await pads.first().click();
        await page.waitForTimeout(mode==="Recall"?1700:180);
      }

      await page.getByRole("button",{name:/Pause session/}).click();
      await expect(page.getByText("PAUSED")).toBeVisible();
      await page.getByRole("button",{name:"End session"}).click();
      await page.getByRole("button",{name:"End & save"}).click();
      await expect(page.getByText("SESSION COMPLETE")).toBeVisible();
      await page.getByText("View history").click();
      await expect(page.getByText("SESSIONS")).toBeVisible();
      await page.getByText("HOME").click();
    }
  });

  test("history survives reload",async({page})=>{
    await page.goto("/");
    await page.getByText("HISTORY").click();
    await page.reload();
    await expect(page.getByText("HISTORY")).toBeVisible();
  });
});
