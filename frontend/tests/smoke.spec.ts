import { test, expect, devices, type Page, type Route } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? '/';

const channel = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'General',
  locked: false,
  expiresAt: null,
};

const alarm = {
  id: 'alarm-regression-1',
  h: 9,
  m: 30,
  s: 0,
  audioId: null,
  audioDisplayName: 'ACLS Nurse Day 01',
  notify_status: 'PENDING',
};

interface MockOptions {
  alarms?: unknown[];
  alarmsHandler?: (route: Route) => Promise<void> | void;
  onUnlock?: (headers: Record<string, string>) => void;
  onLock?: (headers: Record<string, string>) => void;
  onAlarmsDelete?: () => void;
  onChannelDelete?: () => void;
}

async function mockApi(page: Page, options: MockOptions = {}) {
  const alarms = options.alarms ?? [alarm];
  await page.route('**/api/time', (route) => route.fulfill({ json: { iso: new Date().toISOString() } }));
  await page.route('**/api/audio', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/templates', (route) => route.fulfill({ json: { templates: [] } }));
  await page.route('**/api/channels', (route) => route.fulfill({ json: [channel] }));
  await page.route('**/api/channels/*', (route) => {
    if (route.request().method() === 'DELETE') {
      options.onChannelDelete?.();
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ json: channel });
  });
  await page.route('**/api/channels/*/lock', (route) => {
    options.onLock?.(route.request().headers());
    return route.fulfill({ json: { expiresAt: new Date(Date.now() + 30_000).toISOString() } });
  });
  await page.route('**/api/channels/*/unlock', (route) => {
    options.onUnlock?.(route.request().headers());
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/channels/*/alarms', (route) => {
    if (options.alarmsHandler) return options.alarmsHandler(route);
    if (route.request().method() === 'DELETE') {
      options.onAlarmsDelete?.();
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ json: alarms });
  });
}

async function enterChannel(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'เลือก', exact: true }).click();
}

test.describe('Time Alarm — channel flow and dashboard', () => {
  test('picks a channel, sends the lease token, and loads the dashboard without console errors', async ({ page }) => {
    const errors: string[] = [];
    let lockHeaders: Record<string, string> = {};
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await mockApi(page, { onLock: (headers) => { lockHeaders = headers; } });

    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: 'เลือกคอร์ส / ช่องประกาศ' })).toBeVisible();
    await expect(page.getByText('หากเครื่องดับหรือเน็ตหลุด ช่องจะว่างอีกครั้งภายในประมาณ 30 วินาที')).toBeVisible();
    await page.getByRole('button', { name: 'เลือก', exact: true }).click();

    await expect(page.getByText('เวลาปัจจุบัน')).toBeVisible();
    await expect(page.getByText('ขั้นที่ 1 · ตั้งเวลา')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ตารางประกาศวันนี้' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'เพิ่มรายการประกาศ' })).toBeVisible();
    await expect(page.getByText('● เครื่องนี้กำลังคุมช่องนี้')).toBeVisible();

    expect(lockHeaders['x-channel-token']).toBeTruthy();
    const stored = await page.evaluate(() => sessionStorage.getItem('alarm:channel-session'));
    expect(stored).toContain(channel.id);
    expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('readiness card does not claim readiness until the browser audio is enabled', async ({ page }) => {
    await mockApi(page);
    await enterChannel(page);

    await expect(page.getByText('ซิงก์เวลากับเซิร์ฟเวอร์แล้ว')).toBeVisible();
    await expect(page.getByText('⚠ ยังไม่พร้อมเล่นเสียง')).toBeVisible();
    await expect(page.getByText('ยังไม่ได้เปิดเสียงของเบราว์เซอร์')).toBeVisible();
    await expect(page.getByText('✓ พร้อมเล่นเสียงตามเวลา')).toHaveCount(0);
    await expect(page.getByText('ภาษาเสียงทดสอบ')).toBeVisible();
  });

  test('opens and cancels the audio picker without changing the selection', async ({ page }) => {
    await mockApi(page);
    await enterChannel(page);

    await page.getByText('เสียงเตือนมาตรฐาน').click();
    await expect(page.getByRole('heading', { name: 'เลือกไฟล์เสียง', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ยกเลิก' }).click();
    await expect(page.getByRole('heading', { name: 'เลือกไฟล์เสียง', exact: true })).toBeHidden();
    await expect(page.getByText('เสียงเตือนมาตรฐาน')).toBeVisible();
  });

  test('opens and closes the template loader without loading anything', async ({ page }) => {
    await mockApi(page);
    await enterChannel(page);

    await page.getByRole('button', { name: 'โหลดเทมเพลต' }).click();
    await expect(page.getByRole('heading', { name: 'โหลดเทมเพลต' })).toBeVisible();
    await page.getByRole('button', { name: 'ปิด', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'โหลดเทมเพลต' })).toBeHidden();
  });

  test('Clear All defaults to Cancel, closes on Escape, and only deletes after confirming', async ({ page }) => {
    let deleteRequests = 0;
    await mockApi(page, { onAlarmsDelete: () => { deleteRequests += 1; } });
    await enterChannel(page);

    const trigger = page.getByRole('button', { name: 'ล้างรายการทั้งหมด' });
    await trigger.click();
    const dialog = page.getByRole('alertdialog', { name: 'ล้างรายการทั้งหมดหรือไม่?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('ย้อนกลับไม่ได้');
    await expect(dialog.getByRole('button', { name: 'ยกเลิก' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(deleteRequests).toBe(0);
    await expect(page.getByRole('listitem', { name: /รายการเวลา 9:30:0/ })).toBeVisible();

    await trigger.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบรายการทั้งหมด' }).click();
    await expect.poll(() => deleteRequests).toBe(1);
    await expect(page.getByText('ยังไม่มีรายการประกาศ')).toBeVisible();
  });

  test('leaving the channel needs confirmation, defaults to Cancel, and then releases the lock', async ({ page }) => {
    let unlockHeaders: Record<string, string> | null = null;
    await mockApi(page, { onUnlock: (headers) => { unlockHeaders = headers; } });
    await enterChannel(page);

    const trigger = page.getByRole('button', { name: 'ออกจากช่องนี้' });
    await trigger.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('ออกจากช่อง "General"');
    await expect(dialog.getByRole('button', { name: 'ยกเลิก' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(unlockHeaders).toBeNull();

    await trigger.click();
    await page.getByRole('button', { name: 'ออกจากช่องและหยุดเสียง' }).click();
    await expect(page.getByRole('heading', { name: 'เลือกคอร์ส / ช่องประกาศ' })).toBeVisible();
    await expect.poll(() => unlockHeaders?.['x-channel-token']).toBeTruthy();
  });

  test('returns to the picker with a clear notice when another session takes the channel', async ({ page }) => {
    await mockApi(page, {
      alarmsHandler: (route) => route.fulfill({ status: 409, json: { message: 'Channel is in use by another session' } }),
    });
    await enterChannel(page);

    await expect(page.getByRole('heading', { name: 'เลือกคอร์ส / ช่องประกาศ' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('หมดสิทธิ์ใช้ช่องนี้แล้ว');
  });

  test('shows a service error instead of a false empty schedule and can retry', async ({ page }) => {
    let backendAvailable = false;
    await mockApi(page, {
      alarmsHandler: (route) => backendAvailable
        ? route.fulfill({ json: [alarm] })
        : route.fulfill({ status: 503, json: { error: 'unavailable' } }),
    });
    await enterChannel(page);

    const serviceAlert = page.getByRole('alert');
    await expect(serviceAlert).toContainText('โหลดตารางประกาศไม่สำเร็จ');
    await expect(serviceAlert).toContainText('อย่าเข้าใจว่าตารางว่าง');
    await expect(page.getByText('ยังไม่มีรายการประกาศ')).toHaveCount(0);
    await expect(page.getByText('ไม่มีรายการที่รอเล่นในวันนี้')).toHaveCount(0);

    backendAvailable = true;
    await serviceAlert.getByRole('button', { name: 'ลองเชื่อมต่อใหม่' }).click();
    await expect(page.getByRole('list', { name: 'ตารางประกาศ' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /ACLS Nurse Day 01/ })).toBeVisible();
  });

  test('deleting a channel from the picker uses the same confirmation and cancel is safe', async ({ page }) => {
    let deletes = 0;
    await mockApi(page, { onChannelDelete: () => { deletes += 1; } });
    await page.goto(BASE_URL);

    await page.getByRole('button', { name: 'ลบช่อง General' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('ลบช่อง "General"');
    await expect(dialog.getByRole('button', { name: 'ยกเลิก' })).toBeFocused();
    await dialog.getByRole('button', { name: 'ยกเลิก' }).click();
    await expect(dialog).toBeHidden();
    expect(deletes).toBe(0);

    await page.getByRole('button', { name: 'ลบช่อง General' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'ลบช่อง', exact: true }).click();
    await expect.poll(() => deletes).toBe(1);
  });
});

test.describe('Missed announcements', () => {
  test.use({ timezoneId: 'Asia/Bangkok' });

  test('flags past pending alarms as missed and only counts upcoming ones as next', async ({ page }) => {
    await mockApi(page, {
      alarms: [
        { ...alarm, id: 'missed-1', h: 9, m: 30, s: 0, notify_status: 'PENDING' },
        { ...alarm, id: 'upcoming-1', h: 12, m: 30, s: 0, audioDisplayName: 'Upcoming bell', notify_status: 'PENDING' },
        { ...alarm, id: 'sent-1', h: 8, m: 0, s: 0, audioDisplayName: 'Already played', notify_status: 'SENT' },
      ],
    });
    // 05:00Z is 12:00 in Bangkok
    await page.route('**/api/time', (route) => route.fulfill({ json: { iso: '2026-09-21T05:00:00.000Z' } }));
    await enterChannel(page);

    await expect(page.getByRole('alert')).toContainText('มี 1 รายการเลยเวลาแล้วแต่ยังไม่ได้เล่น');
    const missedRow = page.getByRole('listitem', { name: /รายการเวลา 9:30:0/ });
    await expect(missedRow.getByText('พลาดเวลา').filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Upcoming bell/ }).getByText('พลาดเวลา')).toHaveCount(0);
    await expect(page.getByRole('listitem', { name: /Already played/ }).getByText('เล่นแล้ว').filter({ visible: true })).toBeVisible();
    await expect(page.getByText(/12:30:00 · อีก/)).toBeVisible();
  });

  test('shows no missed banner when nothing has been skipped', async ({ page }) => {
    await mockApi(page, { alarms: [{ ...alarm, id: 'upcoming-1', h: 12, m: 30, s: 0, notify_status: 'PENDING' }] });
    await page.route('**/api/time', (route) => route.fulfill({ json: { iso: '2026-09-21T05:00:00.000Z' } }));
    await enterChannel(page);

    await expect(page.getByRole('list', { name: 'ตารางประกาศ' })).toBeVisible();
    await expect(page.getByText('เลยเวลาแล้วแต่ยังไม่ได้เล่น')).toHaveCount(0);
  });
});

test.describe('Channel list states', () => {
  test('shows a loading state instead of "no channels" while the list is being fetched', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/channels', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ json: [] });
    });
    await page.goto(BASE_URL);

    await expect(page.getByText('กำลังโหลดรายการช่อง...')).toBeVisible();
    await expect(page.getByText('ยังไม่มีช่อง')).toHaveCount(0);
    await page.getByLabel('ชื่อช่องใหม่').fill('Course A');
    await expect(page.getByRole('button', { name: 'สร้างช่อง' })).toBeDisabled();

    await expect(page.getByText('ยังไม่มีช่อง สร้างช่องแรกด้านล่าง')).toBeVisible();
    await expect(page.getByRole('button', { name: 'สร้างช่อง' })).toBeEnabled();
  });

  test('shows a failure with retry, never "no channels", and blocks creating while the list is unknown', async ({ page }) => {
    let available = false;
    await mockApi(page);
    await page.route('**/api/channels', (route) => available
      ? route.fulfill({ json: [channel] })
      : route.fulfill({ status: 503, json: { message: 'unavailable' } }));
    await page.goto(BASE_URL);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('โหลดรายการช่องไม่สำเร็จ');
    await expect(page.getByText('ยังไม่มีช่อง')).toHaveCount(0);
    await page.getByLabel('ชื่อช่องใหม่').fill('Course A');
    await expect(page.getByRole('button', { name: 'สร้างช่อง' })).toBeDisabled();

    available = true;
    await alert.getByRole('button', { name: 'ลองใหม่' }).click();
    await expect(page.getByText('General')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('Home layout: one clear next step', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the main action is visible without scrolling and is the only solid primary button', async ({ page }) => {
    await mockApi(page, { alarms: [] });
    await enterChannel(page);

    await expect(page.getByRole('button', { name: 'เพิ่มรายการประกาศ' })).toBeInViewport();
    // the audio check is a secondary (neutral) button, not a second solid-blue call to action
    await expect(page.getByRole('button', { name: 'เปิดเสียง (ทดสอบ)' })).not.toHaveClass(/bg-primary(?!\/)/);
    await expect(page.getByRole('button', { name: 'เพิ่มรายการประกาศ' })).toHaveClass(/bg-primary(?!\/)/);
  });

  test('empty schedule offers one real action and hides irrelevant controls', async ({ page }) => {
    await mockApi(page, { alarms: [] });
    await enterChannel(page);

    await expect(page.getByText('ยังไม่มีรายการประกาศ')).toBeVisible();
    await expect(page.getByText('รายการถัดไป')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'โหลดเทมเพลต' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'เลื่อนเวลารายการที่เลือก' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'จัดระยะห่างเท่ากันระหว่างรายการที่เลือก' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'บันทึกเป็นเทมเพลต' })).toHaveCount(0);
    // still reachable so leftovers hidden by the day filter can be cleared
    await expect(page.getByRole('button', { name: 'ล้างรายการทั้งหมด' })).toBeVisible();

    await page.getByRole('button', { name: 'เริ่มเพิ่มรายการแรก' }).click();
    await expect(page.locator('#hours')).toBeFocused();
  });

  test('the next-item chip sits in the schedule header and disabled actions explain themselves', async ({ page }) => {
    await mockApi(page);
    await enterChannel(page);

    await expect(page.getByText('เลือกรายการในตารางก่อน จึงจะเลื่อนเวลาหรือจัดระยะห่างได้')).toBeVisible();
    await page.getByRole('checkbox', { name: /เลือกรายการเวลา 9:30:0/ }).check();
    await expect(page.getByText('จัดระยะห่างเท่ากันต้องเลือกอย่างน้อย 2 รายการ')).toBeVisible();
    await expect(page.getByRole('button', { name: 'เลื่อนเวลารายการที่เลือก' })).toBeEnabled();
  });
});

test.describe('Viewport sanity', () => {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 900 },
    tablet: { width: 768, height: 1024 },
    mobile: devices['iPhone 13'].viewport,
  })) {
    test(`renders the dashboard at ${name} width`, async ({ page }) => {
      await page.setViewportSize(viewport!);
      await mockApi(page);
      await enterChannel(page);
      await expect(page.getByRole('heading', { name: 'ตารางประกาศวันนี้' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'เพิ่มรายการประกาศ' })).toBeVisible();
    });
  }
});
