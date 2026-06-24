import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HeroService } from './hero.service';
import { interval, Subscription } from 'rxjs';

declare var $: any;

@Injectable({ providedIn: 'root' })
export class WarrantySchedulerService {
  private configUrl = 'assets/config/scheduler-config.json';
  private schedulerSub: Subscription | null = null;

  constructor(private http: HttpClient, private hs: HeroService) {
    // We don't auto-init here because it might cause issues during testing
    // It should be initialized by a component or the main app
  }

  /**
   * Initializes the daily scheduler check.
   * Runs every 30 minutes to check if the daily threshold has been met.
   */
  async initScheduler() {
    if (this.schedulerSub) return;

    console.log('[WarrantyScheduler] Initializing automated daily check...');
    
    // Check every 1 minute for better precision
    this.schedulerSub = interval(60000).subscribe(() => {
      this.checkAndRunScheduler();
    });
    
    // Initial check on startup
    await this.checkAndRunScheduler();
  }

  async checkAndRunScheduler() {
    try {
      // 1. Fetch current configuration from DB
      const config = await this.getConfiguration();
      if (!config) return;

      const lastRun = localStorage.getItem('warranty_scheduler_last_run');
      const today = new Date().toISOString().split('T')[0];

      // If already run today, skip
      if (lastRun === today) {
        return;
      }

      const now = new Date();
      const timeStr = config.time || '09:00';
      const [hour, min] = timeStr.split(':');
      const scheduledTime = new Date();
      scheduledTime.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);

      // Check if current time is past the scheduled time
      if (now >= scheduledTime) {
        console.log(`[WarrantyScheduler] Execution time reached (${timeStr}). ExtendWarranty_BPM trigger is disabled as per configuration.`);
        // Commented out to prevent hitting ExtendWarranty_BPM service when configuration is saved or scheduler runs
        // await this.triggerWarrantyEmails(config.days || config.reminder1);
        localStorage.setItem('warranty_scheduler_last_run', today);
      } else {
        console.log(`[WarrantyScheduler] Waiting for scheduled time: ${timeStr}. Current time: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      }
    } catch (e) {
      console.warn('[WarrantyScheduler] Could not process scheduler task:', e);
    }
  }

  /**
   * Sends the SOAP request to the ExtendWarranty_BPM (Bypassed as per user request)
   */
  async triggerWarrantyEmails(days: number) {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <ExtendWarranty_BPM xmlns="http://schemas.cordys.com/default">
      <INPDur>${days}</INPDur>
    </ExtendWarranty_BPM>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      // Step 0: Ensure valid administrative context
      console.log('[WarrantyScheduler] Refreshing admin authentication context...');
      await new Promise<void>((resolve, reject) => {
        if (typeof $ !== 'undefined' && $.cordys?.authentication?.sso) {
          $.cordys.authentication.sso.authenticate('sourabhs', 'sourabhs')
            .done(() => resolve())
            .fail((err: any) => reject(err));
        } else {
          resolve(); 
        }
      });

      // Commented out to prevent hitting ExtendWarranty_BPM service as per user request
      /*
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      
      // Check for SOAP Fault
      const fault = this.hs.xmltojson(response, 'Fault');
      if (fault) {
        const fs = fault.faultstring || JSON.stringify(fault);
        throw new Error(`Cordys SOAP Fault: ${fs}`);
      }

      console.log(`[WarrantyScheduler] SUCCESS: ExtendWarranty_BPM triggered for ${days} days threshold.`);
      return response;
      */
      console.log(`[WarrantyScheduler] ExtendWarranty_BPM service trigger bypassed for ${days} days.`);
      return null;
    } catch (err) {
      console.error('[WarrantyScheduler] FAILED to trigger ExtendWarranty_BPM:', err);
      throw err;
    }
  }

  /**
   * Admin manual trigger for extending warranty on allocated assets
   * filtered by asset type + subcategory.
   *
   * SOAP method: ExtendWarranty_BPM_final_scheduler
   */
  async extendWarrantyFinalScheduler(payload: { days: number; typeId: string; subCatId: string; assetId?: string; reminder1?: number; reminder2?: number; reminder3?: number }): Promise<{
    instanceId: string;
    rawResponse: any;
  }> {
    const days = Number(payload?.days) || 0;
    const typeId = String(payload?.typeId || '').trim();
    const subCatId = String(payload?.subCatId || '').trim();
    const assetId = String(payload?.assetId || '').trim();
    const reminder1 = payload?.reminder1 || '';
    const reminder2 = payload?.reminder2 || '';
    const reminder3 = payload?.reminder3 || '';

    if (!days || !typeId || !subCatId) {
      throw new Error('days, typeId, and subCatId are required.');
    }

    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <ExtendWarranty_BPM_final_scheduler xmlns="http://schemas.cordys.com/default">
      <days>${days}</days>
      <typeid>${typeId}</typeid>
      <subcatid>${subCatId}</subcatid>
      <assetid>${assetId}</assetid>
      <reminder1>${reminder1}</reminder1>
      <reminder2>${reminder2}</reminder2>
      <reminder3>${reminder3}</reminder3>
    </ExtendWarranty_BPM_final_scheduler>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await new Promise<void>((resolve, reject) => {
        if (typeof $ !== 'undefined' && $.cordys?.authentication?.sso) {
          $.cordys.authentication.sso.authenticate('sourabhs', 'sourabhs')
            .done(() => resolve())
            .fail((err: any) => reject(err));
        } else {
          resolve();
        }
      });

      const response = await this.hs.ajax(null, null, {}, soapRequest);

      const fault = this.hs.xmltojson(response, 'Fault');
      if (fault) {
        const fs = fault.faultstring || JSON.stringify(fault);
        throw new Error(`Cordys SOAP Fault: ${fs}`);
      }

      const dataNode =
        this.hs.xmltojson(response, 'data') ||
        this.hs.xmltojson(response, 'ExtendWarranty_BPM_final_schedulerResponse') ||
        this.hs.xmltojson(response, 'ExtendWarranty_BPM_final_scheduler') ||
        {};

      const instanceId =
        (dataNode as any)?.instance_id ||
        (dataNode as any)?.data?.instance_id ||
        (dataNode as any)?.ExtendWarranty_BPM_final_schedulerResponse?.data?.instance_id ||
        (dataNode as any)?.ExtendWarranty_BPM_final_schedulerResponse?.instance_id ||
        '';

      return { instanceId: String(instanceId || ''), rawResponse: response };
    } catch (err) {
      console.error('[WarrantyScheduler] FAILED ExtendWarranty_BPM_final_scheduler:', err);
      throw err;
    }
  }

  async getConfiguration(): Promise<{ reminder1: number, reminder2: number, reminder3: number, assetId: string, days?: number, time?: string } | null> {
    try {
      const r1 = localStorage.getItem('warranty_scheduler_reminder1');
      const r2 = localStorage.getItem('warranty_scheduler_reminder2');
      const r3 = localStorage.getItem('warranty_scheduler_reminder3');
      const assetId = localStorage.getItem('warranty_scheduler_asset_id');
      const savedDays = localStorage.getItem('warranty_scheduler_days');
      const savedTime = localStorage.getItem('warranty_scheduler_time');
      
      if (r1 || savedDays) {
        return {
          reminder1: r1 ? parseInt(r1, 10) : 7,
          reminder2: r2 ? parseInt(r2, 10) : 15,
          reminder3: r3 ? parseInt(r3, 10) : 30,
          assetId: assetId || '',
          days: savedDays ? parseInt(savedDays, 10) : undefined,
          time: savedTime || undefined
        };
      }
      return null;
    } catch (e) {
      console.error('[WarrantyScheduler] Failed to fetch configuration from localStorage:', e);
      return null;
    }
  }

  async saveConfiguration(reminder1: number, reminder2: number, reminder3: number, assetId: string): Promise<void> {
    try {
      localStorage.setItem('warranty_scheduler_reminder1', reminder1.toString());
      localStorage.setItem('warranty_scheduler_reminder2', reminder2.toString());
      localStorage.setItem('warranty_scheduler_reminder3', reminder3.toString());
      localStorage.setItem('warranty_scheduler_asset_id', assetId || '');
      
      // Clear last run so it can trigger again if the time is set to a future point today
      localStorage.removeItem('warranty_scheduler_last_run');
      
      console.log('[WarrantyScheduler] Configuration saved. Last run reset.');

      // Also update the asset in the database if assetId is provided
      if (assetId) {
        const updateRequest = {
          tuple: {
            old: { m_assets: { asset_id: assetId } },
            new: { m_assets: { temp5: reminder1.toString(), temp6: reminder2.toString(), temp7: reminder3.toString() } }
          }
        };

        try {
          const res = await this.hs.ajax(
            'UpdateM_assets',
            'http://schemas.cordys.com/AMS_Database_Metadata',
            updateRequest
          );
          console.log(`[WarrantyScheduler] Asset ${assetId} reminders updated in DB:`, res);
        } catch (dbErr) {
          console.error(`[WarrantyScheduler] Failed to update asset ${assetId} reminders in DB:`, dbErr);
          throw dbErr;
        }
      }
    } catch (e) {
      console.error('[WarrantyScheduler] Failed to save configuration to localStorage:', e);
      throw e;
    }
  }

  /**
   * Manually triggers the check (e.g., from the Admin UI)
   */
  async runNow() {
    const config = await this.getConfiguration();
    if (config && config.days) {
      return this.triggerWarrantyEmails(config.days);
    }
    return null;
  }
}
