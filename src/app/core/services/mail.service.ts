// import { Injectable } from '@angular/core';
// import emailjs from '@emailjs/browser';
// import { HeroService } from './hero.service';


// /**
//  * Generic, reusable email service powered by EmailJS.
//  *
//  * Usage:
//  *   1. Welcome email  → mailService.sendWelcomeEmail(email, name, password)
//  *   2. Any other email → mailService.sendEmail(templateId, { ...params })
//  *
//  * All outbound emails are routed through the configured EmailJS service.
//  */
// @Injectable({
//   providedIn: 'root'
// })
// export class MailService {

//   // ── EmailJS credentials ──────────────────────────────────────────────
//   private readonly SERVICE_ID = 'service_y8s6jx8';
//   private readonly PUBLIC_KEY = 'cMu81a_oTTdOsVM3x';

//   // Pre-configured template IDs
//   static readonly TEMPLATES = {
//     WELCOME: 'template_776wpxc',
//     // Create a new template on EmailJS for asset requests and put its ID here:
//     ASSET_REQUEST: 'template_776wpxc',  // TODO: replace with dedicated template ID
//   };

//   constructor(private hs: HeroService) { }

//   // ── Generic send ─────────────────────────────────────────────────────

//   /**
//    * Sends an email using any EmailJS template.
//    *
//    * @param templateId  – The EmailJS template ID to use
//    * @param params      – Key-value pairs matching the template variables
//    * @returns             Promise resolving on success
//    */
//   async sendEmail(templateId: string, params: Record<string, string>): Promise<void> {
//     console.log('[MailService] Sending email with params:', JSON.stringify(params, null, 2));
//     try {
//       const response = await emailjs.send(
//         this.SERVICE_ID,
//         templateId,
//         params,
//         { publicKey: this.PUBLIC_KEY }
//       );
//       console.log('[MailService] ✅ Email sent successfully', response.status, response.text);
//     } catch (error) {
//       console.error('[MailService] ❌ Failed to send email', error);
//       throw error;
//     }
//   }

//   // ── Convenience wrappers ─────────────────────────────────────────────

//   /**
//    * Sends a welcome email with login credentials to a newly registered user via Cordys SOAP.
//    */
//   async sendWelcomeEmail(
//     userEmail: string,
//     userName: string,
//     password: string,
//     adminEmail?: string,
//     monitoringEmail?: string
//   ): Promise<void> {
//     console.log('[MailService] sendWelcomeEmail starting for:', userEmail);

//     const subject = 'Your Adnate Asset Management Account is Ready!';
//     const loginUrl = window.location.origin + '/auth/login';

//     const body = `
// Dear ${userName},

// Welcome to Adnate IT Solutions Asset Management System!

// Your professional account has been successfully created. You can now log in to the portal to track your assets, submit new requests, and manage your allocations.

// Below are your secure login credentials:
// Login ID: ${userEmail}
// Initial Password: ${password}

// Access the Portal: ${loginUrl}

// For security reasons, we recommend that you change your password after your first successful login.

// If you have any questions or require assistance, please contact the IT Support Helpdesk.

// Best Regards,
// IT Support Team
// Adnate IT Solutions
//     `.trim();

//     // Recipients list: Registered user + monitoring accounts
//     const recipients = [userEmail, adminEmail, monitoringEmail];

//     // Remove duplicates and empty values
//     const uniqueRecipients = Array.from(new Set(recipients.filter((email): email is string => !!email && email.trim() !== "")));

//     try {
//       for (const email of uniqueRecipients) {
//         await this.sendSoapEmail(email, userName, subject, body);
//       }
//       console.log('[MailService] ✅ All Welcome Emails sent successfully');
//     } catch (error) {
//       console.error('[MailService] ❌ Error in Welcome Email dispatch pipeline:', error);
//       throw error; // Re-throw so caller (UserManagement) knows about the failure
//     }
//   }

//   private xmlEscape(value: string): string {
//     if (!value) return '';
//     return value
//       .replace(/&/g, '&amp;')
//       .replace(/</g, '&lt;')
//       .replace(/>/g, '&gt;')
//       .replace(/"/g, '&quot;')
//       .replace(/'/g, '&apos;');
//   }


//   /**
//    * Sends notification emails to the employee, Team Lead, and Asset Manager 
//    * when a new asset request is raised.
//    */
//   async sendAssetRequestConfirmation(params: {
//     employeeName: string;
//     employeeEmail: string;
//     assetType: string;
//     category: string;
//     requestId: string;
//     justification: string;
//     urgency?: string;
//     teamLeadName?: string;
//     managerEmail?: string;
//     teamLeadEmail?: string;
//   }): Promise<void> {
//     console.log('[MailService] Sending tripartite notifications for request:', params.requestId);
//     console.log('[MailService] Recipient - Employee:', params.employeeEmail);
//     console.log('[MailService] Recipient - Manager:', params.managerEmail || 'Not Provided');
//     console.log('[MailService] Recipient - Team Lead:', params.teamLeadEmail || 'Not Provided');

//     const assetDetails = `Type: ${params.assetType}, Sub-Category: ${params.category}`;
//     const urgency = params.urgency || 'Medium';

//     // ── 1. Notification for the Employee ──
//     const employeeSubject = `Asset Request Submitted - ${params.requestId}`;
//     const employeeBody = `
// Dear ${params.employeeName},

// Your request for a new asset has been successfully submitted and is now pending approval.

// Request Details:
// ---------------------------------------------
// Request ID: ${params.requestId}
// Asset Details: ${assetDetails}
// Urgency: ${urgency}
// Reason: ${params.justification}
// ---------------------------------------------

// You can track the real-time status of your request through the "My Requests" dashboard in the Asset Management Portal.

// Best Regards,
// Asset Management System
//     `.trim();

//     // ── 2. Notification for the Team Lead & Asset Manager ──
//     const managementBodyTemplate = (name: string) => `
// Dear ${name},

// A new asset request has been submitted by ${params.employeeName} and requires your review/allocation.

// Request Summary:
// ---------------------------------------------
// Ticket ID: ${params.requestId}
// Employee Name: ${params.employeeName}
// Asset Required: ${assetDetails}
// Urgency Level: ${urgency}
// Justification: ${params.justification}
// ---------------------------------------------

// Workflow Action:
// Please log in to the Administrator or Team Lead portal to approve/reject this request or proceed with asset allocation.

// Best Regards,
// IT Assets Department
//     `.trim();


//     const tlName = params.teamLeadName || 'Team Lead';

//     // Unique subjects for each role
//     const amSubject = `[Asset Manager Alert] Allocation Required: Request ${params.requestId}`;
//     const tlSubject = `[Team Lead Alert] Review Required: Request ${params.requestId}`;
//     const empSubject = `[Employee Copy] Request Submitted: ${params.requestId}`;

//     // Helper for substantial delay to allow BPM engine processing
//     const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

//     try {
//       // 1. Employee
//       console.log('[MailService] 1/3: Dispatching Employee confirmation...');
//       await this.sendSoapEmail(params.employeeEmail, params.employeeName, empSubject, employeeBody);
//       await delay(1000);

//       // 2. Asset Manager
//       console.log('[MailService] 2/3: Dispatching Asset Manager alert...');
//       if (params.managerEmail) {
//         await this.sendSoapEmail(params.managerEmail, 'Asset Manager', amSubject, managementBodyTemplate('Asset Manager'));
//       }
//       await delay(1500);

//       // 3. Team Lead
//       console.log('[MailService] 3/3: Dispatching Team Lead alert...');
//       if (params.teamLeadEmail) {
//         await this.sendSoapEmail(params.teamLeadEmail, tlName, tlSubject, managementBodyTemplate(tlName));
//       }

//       console.log('[MailService] All tripartite notifications successfully dispatched');
//     } catch (err) {
//       console.error('[MailService] Pipeline failure in multi-email dispatch:', err);
//     }
//   }



//   /**
//    * Notifies the Employee and Asset Manager when the status of a request 
//    * changes (e.g., approved or rejected by Team Lead).
//    */
//   async sendAssetRequestStatusUpdate(params: {
//     requestId: string;
//     employeeName: string;
//     employeeEmail: string;
//     status: 'Approved' | 'Rejected';
//     teamLeadName: string;
//     remarks: string;
//     assetType?: string;
//     managerEmail?: string;
//   }): Promise<void> {
//     console.log(`[MailService] Dispatching status update (${params.status}) for ${params.requestId}`);

//     const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

//     const statusText = params.status === 'Approved' ? 'approved' : 'rejected';
//     const statusColor = params.status === 'Approved' ? 'Green' : 'Red';

//     // ── 1. Body for the Employee ──
//     const employeeSubject = `Update on your Asset Request: ${params.requestId} [${params.status}]`;
//     const employeeBody = `
// Dear ${params.employeeName},

// Your Team Lead, ${params.teamLeadName}, has ${statusText} your asset request.

// Request ID: ${params.requestId}
// Status: ${params.status}
// Remarks: ${params.remarks}

// ${params.status === 'Approved' ? 'Your request has been forwarded to the Asset Manager for final allocation.' : 'Please contact your Team Lead for further clarification.'}

// Best Regards,
// Asset Management Team
//     `.trim();

//     // ── 2. Body for the Asset Manager ──
//     const managerSubject = `[Status Update] Request ${params.requestId} ${params.status} by TL ${params.teamLeadName}`;
//     const managerBody = `
// Dear Asset Manager,

// Notification of status change for Asset Request ${params.requestId}.

// The request submitted by ${params.employeeName} has been ${statusText} by the Team Lead, ${params.teamLeadName}.

// Current Workflow State:
// ---------------------------------------------
// Ticket ID: ${params.requestId}
// Employee Name: ${params.employeeName}
// Action Taken: ${params.status}
// Lead Remarks: ${params.remarks}
// ---------------------------------------------

// ${params.status === 'Approved' ? 'This request is now pending your review and subsequent asset allocation. Please log in to the portal to take the next action.' : 'The workflow for this request has been terminated as it was rejected by the supervisor.'}

// Best Regards,
// ${params.teamLeadName}
// Team Lead
//     `.trim();


//     try {
//       // Send Employee Copy
//       console.log('[MailService] Dispatching Employee status update...');
//       await this.sendSoapEmail(params.employeeEmail, params.employeeName, `[Employee Copy] ${employeeSubject}`, employeeBody);
//       await delay(1000);

//       // Send Manager Copy
//       if (params.managerEmail) {
//         console.log('[MailService] Dispatching Manager status update...');
//         await this.sendSoapEmail(params.managerEmail, 'Asset Manager', managerSubject, managerBody);
//       }

//       console.log('[MailService] Status updates dispatched successfully');
//     } catch (err) {
//       console.error('[MailService] Error in status update dispatch:', err);
//     }
//   }

//   /**
//    * Final decision notification from Asset Manager to Employee and Allocation Team.
//    */
//   async sendAssetManagerStatusUpdate(params: {
//     requestId: string;
//     employeeName: string;
//     status: 'Approved' | 'Rejected';
//     managerName: string;
//     remarks: string;
//     allocationMemberName?: string;
//     assetName?: string;
//     employeeEmail?: string;
//     adminEmail?: string;
//     allocationTeamEmail?: string;
//   }): Promise<void> {
//     console.log(`[MailService] Asset Manager dispatching status (${params.status}) for ${params.requestId}`);

//     const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

//     const statusText = params.status === 'Approved' ? 'approved' : 'rejected';

//     // ── 1. Body for the Employee ──
//     const employeeSubject = `Final Action on your Asset Request: ${params.requestId} [${params.status}]`;
//     const employeeBody = `
// Dear ${params.employeeName},

// The Asset Manager, ${params.managerName}, has ${statusText} your request.

// Request Details:
// ---------------------------------------------
// Ticket ID: ${params.requestId}
// Current Status: ${params.status}
// Manager Remarks: ${params.remarks}
// ---------------------------------------------

// ${params.status === 'Approved' ? `Your request for ${params.assetName || 'the asset'} has been approved. The Allocation Team (${params.allocationMemberName || 'IT Team'}) will coordinate the physical delivery/handoff shortly.` : 'Your request has been declined. Please contact the IT department for further information.'}

// Best Regards,
// Asset Management Team
//     `.trim();

//     // ── 2. Body for the Allocation Team (Only on Approval) ──
//     const allocationSubject = `[Allocation Task] New Approved Request: ${params.requestId}`;
//     const allocationBody = `
// Dear ${params.allocationMemberName || 'Allocation Team'},

// A new asset request has been fully approved by the Asset Manager (${params.managerName}) and is now assigned to you for final allocation.

// Allocation Task Summary:
// ---------------------------------------------
// Request ID: ${params.requestId}
// Employee: ${params.employeeName}
// Asset to Allocate: ${params.assetName || 'Selected Asset'}
// Manager Remarks: ${params.remarks}
// ---------------------------------------------

// Action Required:
// Please retrieve the asset from inventory and complete the handoff to ${params.employeeName}. Once done, mark the task as complete in your dashboard.

// Best Regards,
// Asset Management System
//     `.trim();

//     try {
//       // 1. Send Employee Copy
//       console.log('[MailService] Dispatching Employee final notification...');
//       if (params.employeeEmail) {
//         await this.sendSoapEmail(params.employeeEmail, params.employeeName, `[Employee Copy] ${employeeSubject}`, employeeBody);
//       }
//       await delay(1200);

//       // 2. Send Allocation Team Copy (Only if approved)
//       if (params.status === 'Approved' && params.allocationTeamEmail) {
//         console.log('[MailService] Dispatching Allocation Team notification...');
//         await this.sendSoapEmail(params.allocationTeamEmail, params.allocationMemberName || 'Allocation Team', allocationSubject, allocationBody);
//       }

//       console.log('[MailService] Asset Manager notifications dispatched successfully');
//     } catch (err) {
//       console.error('[MailService] Error in manager notification pipeline:', err);
//     }
//   }

//   /**
//    * Notification from Allocation Team to Asset Manager 
//    * stating that the asset has been physically allocated.
//    */
//   async sendAllocationCompletionNotification(params: {
//     requestId: string,
//     assetName: string,
//     allocationName: string,
//     managerName: string,
//     managerEmail?: string
//   }): Promise<void> {
//     console.log(`[MailService] Allocation Team notifying manager of completion for ${params.requestId}`);

//     const subject = `[Allocation Done] Final Confirmation Required: ${params.requestId}`;
//     const body = `
// Dear ${params.managerName},

// The Allocation Team (${params.allocationName}) has completed the physical allocation of the requested asset.

// Allocation Details:
// ---------------------------------------------
// Request ID: ${params.requestId}
// Asset Name: ${params.assetName}
// Status: Allocated
// ---------------------------------------------

// Action Required:
// Please review the allocation and provide the Final Confirmation in the portal to allow the requester to acknowledge receipt.

// Best Regards,
// Allocation Team
//     `.trim();

//     if (params.managerEmail) {
//       await this.sendSoapEmail(params.managerEmail, params.managerName, subject, body);
//     }
//   }

//   /**
//    * Notifies the employee that their warranty extension request has been rejected.
//    */
//   async sendWarrantyRejectionNotification(params: {
//     employeeName: string;
//     assetName: string;
//     requestId: string;
//     managerName: string;
//     remarks: string;
//     employeeEmail?: string;
//   }): Promise<void> {
//     console.log(`[MailService] Dispatching warranty extension rejection for ${params.requestId}`);

//     const subject = `Warranty Extension Rejected: ${params.assetName} - ${params.requestId}`;
//     const body = `
// Dear ${params.employeeName},

// Your request to extend the warranty for your assigned asset has been reviewed and declined by the Asset Manager.

// Request Details:
// ---------------------------------------------
// Request ID: ${params.requestId}
// Asset Name: ${params.assetName}
// Status: Rejected
// Manager Remarks: ${params.remarks}
// ---------------------------------------------

// If you require further clarification, please contact the IT Assets Department.

// Best Regards,
// IT Assets Department
// Adnate IT Solutions
//     `.trim();

//     if (params.employeeEmail) {
//       await this.sendSoapEmail(params.employeeEmail, params.employeeName, `[Employee Copy] ${subject}`, body);
//     }
//   }


//   /**
//    * Notifies the employee that their warranty extension request has been approved
//    * and the asset's warranty has been updated.
//    */
//   async sendWarrantyExtensionConfirmation(params: {
//     employeeName: string;
//     assetName: string;
//     newExpiryDate: string;
//     requestId: string;
//     employeeEmail?: string;
//   }): Promise<void> {
//     console.log(`[MailService] Dispatching warranty extension confirmation for ${params.requestId}`);

//     const subject = `Warranty Extended: ${params.assetName} - ${params.requestId}`;
//     const body = `
// Dear ${params.employeeName},

// We are pleased to inform you that your request to extend the warranty for your assigned asset has been approved.

// Extension Details:
// ---------------------------------------------
// Request ID: ${params.requestId}
// Asset Name: ${params.assetName}
// New Warranty Expiry: ${params.newExpiryDate}
// Status: Approved & Updated
// ---------------------------------------------

// The official records for this asset have been updated to reflect the new warranty period. No further action is required from your side.

// Best Regards,
// IT Assets Department
// Adnate IT Solutions
//     `.trim();

//     if (params.employeeEmail) {
//       await this.sendSoapEmail(params.employeeEmail, params.employeeName, `[Employee Copy] ${subject}`, body);
//     }
//   }


//   /**
//    * Final notification from Asset Manager to Employee 
//    * for final acknowledgment and task closure.
//    */
//   async sendFinalManagerConfirmationNotification(params: {
//     requestId: string,
//     employeeName: string,
//     managerName: string,
//     assetName: string,
//     employeeEmail?: string
//   }): Promise<void> {
//     console.log(`[MailService] Final Manager confirmation alert for ${params.requestId}`);

//     const subject = `Final Step: Acknowledge Receipt of your Asset - ${params.requestId}`;
//     const body = `
// Dear ${params.employeeName},

// The Asset Manager, ${params.managerName}, has verified the allocation of your new asset (${params.assetName}).

// Final Step:
// ---------------------------------------------
// Ticket ID: ${params.requestId}
// Status: Ready for Handover
// ---------------------------------------------

// Please log in to the Asset Management Portal and "Acknowledge Receipt" to complete the request lifecycle and formally accept the asset.

// Best Regards,
// Asset Management System
//     `.trim();

//     if (params.employeeEmail) {
//       await this.sendSoapEmail(params.employeeEmail, params.employeeName, `[Employee Copy] ${subject}`, body);
//     }
//   }


//   /**
//    * Sends email notifications for Return Request status changes at every stage.
//    * 
//    * Stages:
//    *   - 'submitted'      → Employee submitted, notify Asset Manager
//    *   - 'am_approved'     → Asset Manager approved, notify Allocation Team
//    *   - 'am_rejected'     → Asset Manager rejected, notify Employee
//    *   - 'alloc_approved'  → Allocation Team approved, notify Asset Manager for hand-off
//    *   - 'alloc_rejected'  → Allocation Team rejected, notify Employee
//    *   - 'completed'       → Final approval/hand-off done, notify Employee
//    */
//   async sendReturnRequestNotification(params: {
//     stage: 'submitted' | 'am_approved' | 'am_rejected' | 'alloc_approved' | 'alloc_rejected' | 'completed';
//     returnId: string;
//     employeeName: string;
//     assetName?: string;
//     remarks?: string;
//     actionByName?: string;
//     nextApproverName?: string;
//     recipientEmail?: string;
//   }): Promise<void> {
//     console.log(`[MailService] Return Request notification (${params.stage}) for ${params.returnId}`);

//     const asset = params.assetName || 'Requested Asset';
//     const remarks = params.remarks || '—';
//     const actionBy = params.actionByName || 'System';

//     let subject = '';
//     let body = '';
//     let recipientName = '';

//     switch (params.stage) {
//       case 'submitted':
//         recipientName = params.nextApproverName || 'Asset Manager';
//         subject = `[Return Request] New Return Request: ${params.returnId}`;
//         body = `
// Dear ${recipientName},

// A new asset return request has been submitted and requires your review.

// Return Request Details:
// ---------------------------------------------
// Return ID: ${params.returnId}
// Employee: ${params.employeeName}
// Asset: ${asset}
// ---------------------------------------------

// Please log in to the Asset Management Portal to review and take action on this return request.

// Best Regards,
// Asset Management System
//         `.trim();
//         break;

//       case 'am_approved':
//         recipientName = params.nextApproverName || 'Allocation Team';
//         subject = `[Return Request] Approved by Asset Manager: ${params.returnId}`;
//         body = `
// Dear ${recipientName},

// A return request has been approved by the Asset Manager (${actionBy}) and is now assigned to you for processing.

// Return Request Details:
// ---------------------------------------------
// Return ID: ${params.returnId}
// Employee: ${params.employeeName}
// Asset: ${asset}
// Manager Remarks: ${remarks}
// ---------------------------------------------

// Action Required:
// Please process the return and confirm the asset hand-off in the Allocation Team dashboard.

// Best Regards,
// Asset Management System
//         `.trim();
//         break;

//       case 'am_rejected':
//         recipientName = params.employeeName;
//         subject = `[Return Request] Rejected by Asset Manager: ${params.returnId}`;
//         body = `
// Dear ${params.employeeName},

// Your return request has been reviewed and rejected by the Asset Manager (${actionBy}).

// Return Request Details:
// ---------------------------------------------
// Return ID: ${params.returnId}
// Asset: ${asset}
// Status: Rejected
// Rejection Reason: ${remarks}
// ---------------------------------------------

// If you believe this was in error, please contact the Asset Manager or submit a new return request with updated details.

// Best Regards,
// Asset Management System
//         `.trim();
//         break;

//       case 'alloc_approved':
//         recipientName = params.nextApproverName || 'Asset Manager';
//         subject = `[Return Request] Allocation Team Processed: ${params.returnId}`;
//         body = `
// Dear ${recipientName},

// The Allocation Team (${actionBy}) has processed the return request and confirmed the asset hand-off.

// Return Request Details:
// ---------------------------------------------
// Return ID: ${params.returnId}
// Employee: ${params.employeeName}
// Asset: ${asset}
// Allocation Remarks: ${remarks}
// ---------------------------------------------

// Action Required:
// Please provide the final confirmation in your dashboard to close this return request.

// Best Regards,
// Asset Management System
//         `.trim();
//         break;

//       case 'alloc_rejected':
//         recipientName = params.employeeName;
//         subject = `[Return Request] Rejected by Allocation Team: ${params.returnId}`;
//         body = `
// Dear ${params.employeeName},

// Your return request has been reviewed and rejected by the Allocation Team (${actionBy}).

// Return Request Details:
// ---------------------------------------------
// Return ID: ${params.returnId}
// Asset: ${asset}
// Status: Rejected
// Rejection Reason: ${remarks}
// ---------------------------------------------

// If you still wish to return this asset, please submit a new return request.

// Best Regards,
// Asset Management System
//         `.trim();
//         break;

//       case 'completed':
//         recipientName = params.employeeName;
//         subject = `[Return Request] Completed: ${params.returnId}`;
//         body = `
// Dear ${params.employeeName},

// Your return request has been fully processed and completed.

// Return Request Details:
// ---------------------------------------------
// Return ID: ${params.returnId}
// Asset: ${asset}
// Status: Completed
// Final Remarks: ${remarks}
// ---------------------------------------------

// The asset has been successfully returned and records have been updated. No further action is required.

// Best Regards,
// Asset Management System
//         `.trim();
//         break;
//     }

//     try {
//       if (params.recipientEmail) {
//         await this.sendSoapEmail(params.recipientEmail, recipientName, subject, body);
//       }
//       console.log(`[MailService] Return notification (${params.stage}) sent successfully`);
//     } catch (err) {
//       console.error(`[MailService] Failed to send return notification (${params.stage}):`, err);
//     }
//   }



//   /**
//    * Helper to send a raw SOAP email via Cordys WelcomeEmail_BPM activity.

//    */
//   private async sendSoapEmail(to: string, name: string, subject: string, body: string): Promise<void> {
//     const soap = `
// <SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
//   <SOAP:Body>
//     <WelcomeEmail_BPM xmlns="http://schemas.cordys.com/default">
//       <toemail>${this.xmlEscape(to)}</toemail>
//       <toname>${this.xmlEscape(name)}</toname>
//       <subject>${this.xmlEscape(subject)}</subject>
//       <body>${this.xmlEscape(body)}</body>
//     </WelcomeEmail_BPM>
//   </SOAP:Body>
// </SOAP:Envelope>`.trim();

//     try {
//       const resp = await this.hs.ajax(null, null, {}, soap);

//       // Check for SOAP Fault within a successful AJAX response
//       const fault = this.hs.xmltojson(resp, 'Fault');
//       if (fault) {
//         const faultString = fault.faultstring || fault.Faultstring || JSON.stringify(fault);
//         throw new Error(`Cordys SOAP Fault: ${faultString}`);
//       }

//       console.log(`[MailService] SOAP Email sent to ${to}`);
//     } catch (err: any) {
//       console.error(`[MailService] Failed to send SOAP Email to ${to}`, err);
//       let detail = err?.message || err?.responseText || err?.errorThrown || '';
//       if (typeof detail !== 'string') detail = JSON.stringify(err);
//       throw new Error(`Email Dispatch Failed for ${to}: ${detail}`);
//     }
//   }


//   /**
//    * Sends a notification email to the team leader about a new asset request.
//    */
//   async sendAssetRequestToTeamLead(params: {
//     teamLeadName: string;
//     teamLeadEmail: string;
//     employeeName: string;
//     assetType: string;
//     category: string;
//     requestId: string;
//     justification: string;
//   }): Promise<void> {
//     console.log('[MailService] sendAssetRequestToTeamLead:', params);

//     const templateParams: Record<string, string> = {
//       name: params.teamLeadName,
//       userName: params.teamLeadName,
//       to_email: params.teamLeadEmail || '',
//       email: `Request by: ${params.employeeName} | Asset: ${params.assetType} | Category: ${params.category}`,
//       password: `Request ID: ${params.requestId} | Reason: ${params.justification}`,
//       loginUrl: window.location.origin + '/team-lead/dashboard'
//     };

//     return this.sendEmail(MailService.TEMPLATES.ASSET_REQUEST, templateParams);
//   }
// }


import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { HeroService } from './hero.service';


/**
 * Generic, reusable email service powered by EmailJS.
 *
 * Usage:
 *   1. Welcome email  → mailService.sendWelcomeEmail(email, name, password)
 *   2. Any other email → mailService.sendEmail(templateId, { ...params })
 *
 * All outbound emails are routed through the configured EmailJS service.
 */
@Injectable({
  providedIn: 'root'
})
export class MailService {

  // ── EmailJS credentials ──────────────────────────────────────────────
  private readonly SERVICE_ID = 'service_y8s6jx8';
  private readonly PUBLIC_KEY = 'cMu81a_oTTdOsVM3x';

  // Pre-configured template IDs
  static readonly TEMPLATES = {
    WELCOME: 'template_776wpxc',
    // Create a new template on EmailJS for asset requests and put its ID here:
    ASSET_REQUEST: 'template_776wpxc',  // TODO: replace with dedicated template ID
  };

  constructor(private hs: HeroService) { }

  // ── Generic send ─────────────────────────────────────────────────────

  /**
   * Sends an email using any EmailJS template.
   *
   * @param templateId  – The EmailJS template ID to use
   * @param params      – Key-value pairs matching the template variables
   * @returns             Promise resolving on success
   */
  async sendEmail(templateId: string, params: Record<string, string>): Promise<void> {
    console.log('[MailService] Sending email with params:', JSON.stringify(params, null, 2));
    try {
      const response = await emailjs.send(
        this.SERVICE_ID,
        templateId,
        params,
        { publicKey: this.PUBLIC_KEY }
      );
      console.log('[MailService] ✅ Email sent successfully', response.status, response.text);
    } catch (error) {
      console.error('[MailService] ❌ Failed to send email', error);
      throw error;
    }
  }

  // ── Convenience wrappers ─────────────────────────────────────────────

  /**
   * Sends a welcome email with login credentials to a newly registered user via Cordys SOAP.
   */
  async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    password: string
  ): Promise<void> {
    console.log('[MailService] sendWelcomeEmail starting for:', userEmail);

    const subject = 'Your Adnate Asset Management Account is Ready!';
    const loginUrl = window.location.origin + '/auth/login';

    const body = `
Dear ${userName},

Welcome to Adnate IT Solutions Asset Management System!

Your professional account has been successfully created. You can now log in to the portal to track your assets, submit new requests, and manage your allocations.

Below are your secure login credentials:
Login ID: ${userEmail}
Initial Password: ${password}

Access the Portal: ${loginUrl}

For security reasons, we recommend that you change your password after your first successful login.

If you have any questions or require assistance, please contact the IT Support Helpdesk.

Best Regards,
IT Support Team
Adnate IT Solutions
    `.trim();

    // Recipients list: Registered user
    const recipients = [userEmail];

    // Remove duplicates and empty values
    const uniqueRecipients = Array.from(new Set(recipients.filter(email => !!email && email.trim() !== "")));

    try {
      for (const email of uniqueRecipients) {
        await this.sendSoapEmail(email, userName, subject, body);
      }
      console.log('[MailService] ✅ All Welcome Emails sent successfully');
    } catch (error) {
      console.error('[MailService] ❌ Error in Welcome Email dispatch pipeline:', error);
      throw error; // Re-throw so caller (UserManagement) knows about the failure
    }
  }

  private xmlEscape(value: string): string {
    if (!value) return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }


  /**
   * Sends notification emails to the employee, Team Lead, and Asset Manager 
   * when a new asset request is raised.
   */
  async sendAssetRequestConfirmation(params: {
    employeeName: string;
    employeeEmail: string;
    assetType: string;
    category: string;
    requestId: string;
    justification: string;
    urgency?: string;
    teamLeadName?: string;
  }): Promise<void> {
    console.log('[MailService] Sending tripartite notifications for request:', params.requestId);

    const assetDetails = `Type: ${params.assetType}, Sub-Category: ${params.category}`;
    const urgency = params.urgency || 'Medium';

    // ── 1. Notification for the Employee ──
    const employeeSubject = `Asset Request Submitted - ${params.requestId}`;
    const employeeBody = `
Dear ${params.employeeName},

Your request for a new asset has been successfully submitted and is now pending approval.

Request Details:
---------------------------------------------
Request ID: ${params.requestId}
Asset Details: ${assetDetails}
Urgency: ${urgency}
Reason: ${params.justification}
---------------------------------------------

You can track the real-time status of your request through the "My Requests" dashboard in the Asset Management Portal.

Best Regards,
Asset Management System
    `.trim();

    // ── 2. Notification for the Team Lead & Asset Manager ──
    // Note: Per user request, management emails are sent to the designated test address
    const managementEmail = 'sourabhsharma1003@gmail.com';
    const managementBodyTemplate = (name: string) => `
Dear ${name},

A new asset request has been submitted by ${params.employeeName} and requires your review/allocation.

Request Summary:
---------------------------------------------
Ticket ID: ${params.requestId}
Employee Name: ${params.employeeName}
Asset Required: ${assetDetails}
Urgency Level: ${urgency}
Justification: ${params.justification}
---------------------------------------------

Workflow Action:
Please log in to the Administrator or Team Lead portal to approve/reject this request or proceed with asset allocation.

Best Regards,
IT Assets Department
    `.trim();


    const tlName = params.teamLeadName || 'Team Lead';
    const testEmail = 'sourabhsharma1003@gmail.com';

    // Unique subjects for each role
    const amSubject = `[Asset Manager Alert] Allocation Required: Request ${params.requestId}`;
    const tlSubject = `[Team Lead Alert] Review Required: Request ${params.requestId}`;
    const empSubject = `[Employee Copy] Request Submitted: ${params.requestId}`;

    // Helper for substantial delay to allow BPM engine processing
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      // 1. Asset Manager
      console.log('[MailService] 1/3: Dispatching Asset Manager alert...');
      await this.sendSoapEmail(testEmail, 'Asset Manager', amSubject, managementBodyTemplate('Asset Manager'));
      await delay(1500);

      // 2. Team Lead
      console.log('[MailService] 2/3: Dispatching Team Lead alert...');
      await this.sendSoapEmail(testEmail, tlName, tlSubject, managementBodyTemplate(tlName));
      await delay(1500);


      // 3. Employee
      console.log('[MailService] 3/3: Dispatching Employee confirmation...');
      await this.sendSoapEmail(testEmail, params.employeeName, empSubject, employeeBody);

      console.log('[MailService] All tripartite notifications successfully dispatched');
    } catch (err) {
      console.error('[MailService] Pipeline failure in multi-email dispatch:', err);
    }
  }



  /**
   * Notifies the Employee and Asset Manager when the status of a request 
   * changes (e.g., approved or rejected by Team Lead).
   */
  async sendAssetRequestStatusUpdate(params: {
    requestId: string;
    employeeName: string;
    employeeEmail: string;
    status: 'Approved' | 'Rejected';
    teamLeadName: string;
    remarks: string;
    assetType?: string;
  }): Promise<void> {
    console.log(`[MailService] Dispatching status update (${params.status}) for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const statusText = params.status === 'Approved' ? 'approved' : 'rejected';
    const statusColor = params.status === 'Approved' ? 'Green' : 'Red';

    // ── 1. Body for the Employee ──
    const employeeSubject = `Update on your Asset Request: ${params.requestId} [${params.status}]`;
    const employeeBody = `
Dear ${params.employeeName},

Your Team Lead, ${params.teamLeadName}, has ${statusText} your asset request.

Request ID: ${params.requestId}
Status: ${params.status}
Remarks: ${params.remarks}

${params.status === 'Approved' ? 'Your request has been forwarded to the Asset Manager for final allocation.' : 'Please contact your Team Lead for further clarification.'}

Best Regards,
Asset Management Team
    `.trim();

    // ── 2. Body for the Asset Manager ──
    const managerSubject = `[Status Update] Request ${params.requestId} ${params.status} by TL ${params.teamLeadName}`;
    const managerBody = `
Dear Asset Manager,

Notification of status change for Asset Request ${params.requestId}.

The request submitted by ${params.employeeName} has been ${statusText} by the Team Lead, ${params.teamLeadName}.

Current Workflow State:
---------------------------------------------
Ticket ID: ${params.requestId}
Employee Name: ${params.employeeName}
Action Taken: ${params.status}
Lead Remarks: ${params.remarks}
---------------------------------------------

${params.status === 'Approved' ? 'This request is now pending your review and subsequent asset allocation. Please log in to the portal to take the next action.' : 'The workflow for this request has been terminated as it was rejected by the supervisor.'}

Best Regards,
${params.teamLeadName}
Team Lead
    `.trim();


    try {
      // Send Employee Copy (to test email for verification as requested by workflow)
      console.log('[MailService] Dispatching Employee status update...');
      await this.sendSoapEmail(testEmail, params.employeeName, `[Employee Copy] ${employeeSubject}`, employeeBody);
      await delay(1000);

      // Send Manager Copy
      console.log('[MailService] Dispatching Manager status update...');
      await this.sendSoapEmail(testEmail, 'Asset Manager', managerSubject, managerBody);

      console.log('[MailService] Status updates dispatched successfully');
    } catch (err) {
      console.error('[MailService] Error in status update dispatch:', err);
    }
  }

  /**
   * Final decision notification from Asset Manager to Employee and Allocation Team.
   */
  async sendAssetManagerStatusUpdate(params: {
    requestId: string;
    employeeName: string;
    status: 'Approved' | 'Rejected';
    managerName: string;
    remarks: string;
    allocationMemberName?: string;
    assetName?: string;
  }): Promise<void> {
    console.log(`[MailService] Asset Manager dispatching status (${params.status}) for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const statusText = params.status === 'Approved' ? 'approved' : 'rejected';

    // ── 1. Body for the Employee ──
    const employeeSubject = `Final Action on your Asset Request: ${params.requestId} [${params.status}]`;
    const employeeBody = `
Dear ${params.employeeName},

The Asset Manager, ${params.managerName}, has ${statusText} your request.

Request Details:
---------------------------------------------
Ticket ID: ${params.requestId}
Current Status: ${params.status}
Manager Remarks: ${params.remarks}
---------------------------------------------

${params.status === 'Approved' ? `Your request for ${params.assetName || 'the asset'} has been approved. The Allocation Team (${params.allocationMemberName || 'IT Team'}) will coordinate the physical delivery/handoff shortly.` : 'Your request has been declined. Please contact the IT department for further information.'}

Best Regards,
Asset Management Team
    `.trim();

    // ── 2. Body for the Allocation Team (Only on Approval) ──
    const allocationSubject = `[Allocation Task] New Approved Request: ${params.requestId}`;
    const allocationBody = `
Dear ${params.allocationMemberName || 'Allocation Team'},

A new asset request has been fully approved by the Asset Manager (${params.managerName}) and is now assigned to you for final allocation.

Allocation Task Summary:
---------------------------------------------
Request ID: ${params.requestId}
Employee: ${params.employeeName}
Asset to Allocate: ${params.assetName || 'Selected Asset'}
Manager Remarks: ${params.remarks}
---------------------------------------------

Action Required:
Please retrieve the asset from inventory and complete the handoff to ${params.employeeName}. Once done, mark the task as complete in your dashboard.

Best Regards,
Asset Management System
    `.trim();

    try {
      // 1. Send Employee Copy
      console.log('[MailService] Dispatching Employee final notification...');
      await this.sendSoapEmail(testEmail, params.employeeName, `[Employee Copy] ${employeeSubject}`, employeeBody);
      await delay(1200);

      // 2. Send Allocation Team Copy (Only if approved)
      if (params.status === 'Approved') {
        console.log('[MailService] Dispatching Allocation Team notification...');
        await this.sendSoapEmail(testEmail, params.allocationMemberName || 'Allocation Team', allocationSubject, allocationBody);
      }

      console.log('[MailService] Asset Manager notifications dispatched successfully');
    } catch (err) {
      console.error('[MailService] Error in manager notification pipeline:', err);
    }
  }

  /**
   * Notification from Allocation Team to Asset Manager 
   * stating that the asset has been physically allocated.
   */
  async sendAllocationCompletionNotification(params: {
    requestId: string,
    assetName: string,
    allocationName: string,
    managerName: string
  }): Promise<void> {
    console.log(`[MailService] Allocation Team notifying manager of completion for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const subject = `[Allocation Done] Final Confirmation Required: ${params.requestId}`;
    const body = `
Dear ${params.managerName},

The Allocation Team (${params.allocationName}) has completed the physical allocation of the requested asset.

Allocation Details:
---------------------------------------------
Request ID: ${params.requestId}
Asset Name: ${params.assetName}
Status: Allocated
---------------------------------------------

Action Required:
Please review the allocation and provide the Final Confirmation in the portal to allow the requester to acknowledge receipt.

Best Regards,
Allocation Team
    `.trim();

    await this.sendSoapEmail(testEmail, params.managerName, subject, body);
  }

  /**
   * Notifies the employee and asset manager when a warranty extension request is submitted.
   */
  async sendWarrantyRequestSubmissionNotification(params: {
    employeeName: string;
    assetName: string;
    requestId: string;
    justification: string;
  }): Promise<void> {
    console.log(`[MailService] Dispatching warranty extension submission for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const subject = `Warranty Extension Request Submitted: ${params.assetName} - ${params.requestId}`;
    
    // Employee Email
    const employeeBody = `
Dear ${params.employeeName},

Your request to extend the warranty for ${params.assetName} has been successfully submitted and is now pending review by the Asset Manager.

Request Details:
---------------------------------------------
Request ID: ${params.requestId}
Asset Name: ${params.assetName}
Reason: ${params.justification}
Status: Pending
---------------------------------------------

You can track the progress in the "My Requests" dashboard.

Best Regards,
Asset Management System
    `.trim();

    // Manager Email
    const managerBody = `
Dear Asset Manager,

A new warranty extension request has been submitted by ${params.employeeName}.

Request Details:
---------------------------------------------
Request ID: ${params.requestId}
Employee: ${params.employeeName}
Asset: ${params.assetName}
Reason: ${params.justification}
---------------------------------------------

Please log in to the Asset Manager dashboard to review this request.

Best Regards,
Asset Management System
    `.trim();

    try {
      await this.sendSoapEmail(testEmail, params.employeeName, `[Employee Copy] ${subject}`, employeeBody);
      await new Promise(res => setTimeout(res, 1000));
      await this.sendSoapEmail(testEmail, 'Asset Manager', `[Manager Alert] ${subject}`, managerBody);
    } catch (err) {
      console.error('[MailService] Error in warranty submission notification:', err);
    }
  }

  /**
   * Notifies the allocation team when the manager approves a warranty extension.
   */
  async sendWarrantyManagerApprovalNotification(params: {
    employeeName: string;
    assetName: string;
    requestId: string;
    managerName: string;
    remarks: string;
    allocationMemberName: string;
  }): Promise<void> {
    console.log(`[MailService] Dispatching warranty manager approval for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const subject = `[Allocation Task] Warranty Extension Approved: ${params.requestId}`;
    const body = `
Dear ${params.allocationMemberName},

The Asset Manager (${params.managerName}) has approved the warranty extension request for ${params.employeeName}'s asset (${params.assetName}).

Task Details:
---------------------------------------------
Request ID: ${params.requestId}
Employee: ${params.employeeName}
Asset: ${params.assetName}
Manager Remarks: ${params.remarks}
---------------------------------------------

Action Required:
Please update the asset record with the extended warranty details in the Allocation Team portal.

Best Regards,
Asset Management System
    `.trim();

    await this.sendSoapEmail(testEmail, params.allocationMemberName, subject, body);
  }

  /**
   * Notifies the employee that their warranty extension request has been rejected.
   */
  async sendWarrantyRejectionNotification(params: {
    employeeName: string;
    assetName: string;
    requestId: string;
    managerName: string;
    remarks: string;
  }): Promise<void> {
    console.log(`[MailService] Dispatching warranty extension rejection for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const subject = `Warranty Extension Rejected: ${params.assetName} - ${params.requestId}`;
    const body = `
Dear ${params.employeeName},

Your request to extend the warranty for your assigned asset has been reviewed and declined by the Asset Manager.

Request Details:
---------------------------------------------
Request ID: ${params.requestId}
Asset Name: ${params.assetName}
Status: Rejected
Manager Remarks: ${params.remarks}
---------------------------------------------

If you require further clarification, please contact the IT Assets Department.

Best Regards,
IT Assets Department
Adnate IT Solutions
    `.trim();

    await this.sendSoapEmail(testEmail, params.employeeName, `[Employee Copy] ${subject}`, body);
  }


  /**
   * Notifies the employee that their warranty extension request has been approved
   * and the asset's warranty has been updated.
   */
  async sendWarrantyExtensionConfirmation(params: {
    employeeName: string;
    assetName: string;
    newExpiryDate: string;
    requestId: string;
  }): Promise<void> {
    console.log(`[MailService] Dispatching warranty extension confirmation for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const subject = `Warranty Extended: ${params.assetName} - ${params.requestId}`;
    const body = `
Dear ${params.employeeName},

We are pleased to inform you that your request to extend the warranty for your assigned asset has been approved.

Extension Details:
---------------------------------------------
Request ID: ${params.requestId}
Asset Name: ${params.assetName}
New Warranty Expiry: ${params.newExpiryDate}
Status: Approved & Updated
---------------------------------------------

The official records for this asset have been updated to reflect the new warranty period. No further action is required from your side.

Best Regards,
IT Assets Department
Adnate IT Solutions
    `.trim();

    await this.sendSoapEmail(testEmail, params.employeeName, `[Employee Copy] ${subject}`, body);
  }


  /**
   * Final notification from Asset Manager to Employee 
   * for final acknowledgment and task closure.
   */
  async sendFinalManagerConfirmationNotification(params: {
    requestId: string,
    employeeName: string,
    managerName: string,
    assetName: string
  }): Promise<void> {
    console.log(`[MailService] Final Manager confirmation alert for ${params.requestId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const subject = `Final Step: Acknowledge Receipt of your Asset - ${params.requestId}`;
    const body = `
Dear ${params.employeeName},

The Asset Manager, ${params.managerName}, has verified the allocation of your new asset (${params.assetName}).

Final Step:
---------------------------------------------
Ticket ID: ${params.requestId}
Status: Ready for Handover
---------------------------------------------

Please log in to the Asset Management Portal and "Acknowledge Receipt" to complete the request lifecycle and formally accept the asset.

Best Regards,
Asset Management System
    `.trim();

    await this.sendSoapEmail(testEmail, params.employeeName, `[Employee Copy] ${subject}`, body);
  }

  async sendServiceRequestNotification(params: {
    stage: 'submitted' | 'stage1_approved' | 'stage2_approved' | 'stage3_approved' | 'serviced' | 'temp_returned' | 'handover_completed';
    serviceRequestId: string;
    employeeName?: string;
    employeeEmail?: string;
    teamLeadName?: string;
    teamLeadEmail?: string;
    assetManagerName?: string;
    assetManagerEmail?: string;
    allocationName?: string;
    allocationEmail?: string;
    assetName?: string;
    assetTag?: string;
    issueDescription?: string;
    urgency?: string;
    remarks?: string;
    actionByName?: string;
    tempAssetId?: string;
    tempAssetName?: string;
    servicedBy?: string;
    serviceCost?: string;
    expectedReturnDate?: string;
  }): Promise<void> {
    const fallbackEmail = 'sourabhsharma1003@gmail.com';
    const employeeName = params.employeeName || 'Employee';
    const asset = [params.assetName, params.assetTag].filter(Boolean).join(' - ') || 'Service Asset';
    const remarks = params.remarks || 'No remarks provided';
    const urgency = params.urgency || 'Medium';
    const actionBy = params.actionByName || 'Asset Management System';
    const tempAsset = params.tempAssetName || params.tempAssetId || 'Temporary asset';

    const messages: Array<{ toEmail?: string; toName: string; subject: string; body: string }> = [];

    const addMessage = (toEmail: string | undefined, toName: string | undefined, subject: string, body: string) => {
      messages.push({
        toEmail: toEmail || fallbackEmail,
        toName: toName || 'Recipient',
        subject,
        body
      });
    };

    switch (params.stage) {
      case 'submitted':
        addMessage(params.employeeEmail, employeeName, `Service Request Submitted - ${params.serviceRequestId}`, `
Dear ${employeeName},

Your service request has been submitted successfully.

Service Request Details:
---------------------------------------------
Request ID: ${params.serviceRequestId}
Asset: ${asset}
Urgency: ${urgency}
Issue: ${params.issueDescription || remarks}
---------------------------------------------

You can track the request status from the Asset Management Portal.

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.teamLeadEmail, params.teamLeadName || 'Team Lead', `[Service Request] New request raised: ${params.serviceRequestId}`, `
Dear ${params.teamLeadName || 'Team Lead'},

${employeeName} has raised a service request for an assigned asset.

Service Request Details:
---------------------------------------------
Request ID: ${params.serviceRequestId}
Employee: ${employeeName}
Asset: ${asset}
Urgency: ${urgency}
Issue: ${params.issueDescription || remarks}
---------------------------------------------

This is for your visibility.

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.assetManagerEmail, params.assetManagerName || 'Asset Manager', `[Service Request] Approval required: ${params.serviceRequestId}`, `
Dear ${params.assetManagerName || 'Asset Manager'},

A new service request has been submitted and requires your review.

Service Request Details:
---------------------------------------------
Request ID: ${params.serviceRequestId}
Employee: ${employeeName}
Asset: ${asset}
Urgency: ${urgency}
Issue: ${params.issueDescription || remarks}
---------------------------------------------

Please review and take action from the Asset Manager portal.

Best Regards,
Asset Management System
        `.trim());
        break;

      case 'stage1_approved':
        addMessage(params.employeeEmail, employeeName, `Service Request Approved by Asset Manager - ${params.serviceRequestId}`, `
Dear ${employeeName},

Your service request has been approved by ${actionBy} and forwarded to the Allocation Team for collection.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.allocationEmail, params.allocationName || 'Allocation Team', `[Service Request] Asset collection required: ${params.serviceRequestId}`, `
Dear ${params.allocationName || 'Allocation Team'},

The Asset Manager has approved a service request and assigned it to you for asset collection.

Request ID: ${params.serviceRequestId}
Employee: ${employeeName}
Asset: ${asset}
Remarks: ${remarks}

Please collect the asset and update the service collection status.

Best Regards,
Asset Management System
        `.trim());
        break;

      case 'stage2_approved':
        addMessage(params.employeeEmail, employeeName, `Asset Collected for Service - ${params.serviceRequestId}`, `
Dear ${employeeName},

The Allocation Team has collected your asset for service.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.assetManagerEmail, params.assetManagerName || 'Asset Manager', `[Service Request] Final approval required: ${params.serviceRequestId}`, `
Dear ${params.assetManagerName || 'Asset Manager'},

The Allocation Team has completed collection for this service request. Final approval is now required.

Request ID: ${params.serviceRequestId}
Employee: ${employeeName}
Asset: ${asset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());
        break;

      case 'stage3_approved':
        addMessage(params.employeeEmail, employeeName, `Service Request Moved to Service - ${params.serviceRequestId}`, `
Dear ${employeeName},

Your service request has received final approval and the asset is now marked On Service.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
${params.tempAssetId || params.tempAssetName ? `Temporary Asset: ${tempAsset}` : ''}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.teamLeadEmail, params.teamLeadName || 'Team Lead', `[Service Request] Final approval completed: ${params.serviceRequestId}`, `
Dear ${params.teamLeadName || 'Team Lead'},

The service request for ${employeeName} has received final Asset Manager approval.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
${params.tempAssetId || params.tempAssetName ? `Temporary Asset: ${tempAsset}` : ''}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());
        break;

      case 'serviced':
        addMessage(params.employeeEmail, employeeName, `Asset Service Completed - ${params.serviceRequestId}`, `
Dear ${employeeName},

Your asset service has been completed.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
Serviced By: ${params.servicedBy || 'Internal'}
Service Cost: ${params.serviceCost || '0'}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());
        break;

      case 'temp_returned':
        addMessage(params.employeeEmail, employeeName, `Temporary Asset Returned - ${params.serviceRequestId}`, `
Dear ${employeeName},

The temporary asset linked to your service request has been returned.

Request ID: ${params.serviceRequestId}
Temporary Asset: ${tempAsset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.teamLeadEmail, params.teamLeadName || 'Team Lead', `[Service Request] Temporary asset returned: ${params.serviceRequestId}`, `
Dear ${params.teamLeadName || 'Team Lead'},

The temporary asset for ${employeeName}'s service request has been returned.

Request ID: ${params.serviceRequestId}
Temporary Asset: ${tempAsset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());
        break;

      case 'handover_completed':
        addMessage(params.employeeEmail, employeeName, `Serviced Asset Handed Over - ${params.serviceRequestId}`, `
Dear ${employeeName},

Your serviced asset has been handed over and the service request is now closed.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());

        addMessage(params.teamLeadEmail, params.teamLeadName || 'Team Lead', `[Service Request] Handover completed: ${params.serviceRequestId}`, `
Dear ${params.teamLeadName || 'Team Lead'},

The serviced asset has been handed over to ${employeeName} and the service request is closed.

Request ID: ${params.serviceRequestId}
Asset: ${asset}
Remarks: ${remarks}

Best Regards,
Asset Management System
        `.trim());
        break;
    }

    for (const message of messages) {
      const recipients = Array.from(new Set([message.toEmail || fallbackEmail, fallbackEmail].filter(email => !!email && email.trim() !== '')));
      for (const recipient of recipients) {
        try {
          await this.sendSoapEmail(recipient, message.toName, message.subject, message.body);
        } catch (err) {
          console.error(`[MailService] Failed service email (${params.stage}) to ${recipient}:`, err);
        }
      }
    }

    console.log(`[MailService] Service notification (${params.stage}) processed for ${params.serviceRequestId}`);
  }


  /**
   * Sends email notifications for Return Request status changes at every stage.
   * 
   * Stages:
   *   - 'submitted'      → Employee submitted, notify Asset Manager
   *   - 'am_approved'     → Asset Manager approved, notify Allocation Team
   *   - 'am_rejected'     → Asset Manager rejected, notify Employee
   *   - 'alloc_approved'  → Allocation Team approved, notify Asset Manager for hand-off
   *   - 'alloc_rejected'  → Allocation Team rejected, notify Employee
   *   - 'completed'       → Final approval/hand-off done, notify Employee
   */
  async sendReturnRequestNotification(params: {
    stage: 'submitted' | 'am_approved' | 'am_rejected' | 'alloc_approved' | 'alloc_rejected' | 'completed';
    returnId: string;
    employeeName: string;
    assetName?: string;
    remarks?: string;
    actionByName?: string;
    nextApproverName?: string;
  }): Promise<void> {
    console.log(`[MailService] Return Request notification (${params.stage}) for ${params.returnId}`);

    const testEmail = 'sourabhsharma1003@gmail.com';
    const asset = params.assetName || 'Requested Asset';
    const remarks = params.remarks || '—';
    const actionBy = params.actionByName || 'System';

    let subject = '';
    let body = '';
    let recipientName = '';

    switch (params.stage) {
      case 'submitted':
        recipientName = params.nextApproverName || 'Asset Manager';
        subject = `[Return Request] New Return Request: ${params.returnId}`;
        body = `
Dear ${recipientName},

A new asset return request has been submitted and requires your review.

Return Request Details:
---------------------------------------------
Return ID: ${params.returnId}
Employee: ${params.employeeName}
Asset: ${asset}
---------------------------------------------

Please log in to the Asset Management Portal to review and take action on this return request.

Best Regards,
Asset Management System
        `.trim();
        break;

      case 'am_approved':
        recipientName = params.nextApproverName || 'Allocation Team';
        subject = `[Return Request] Approved by Asset Manager: ${params.returnId}`;
        body = `
Dear ${recipientName},

A return request has been approved by the Asset Manager (${actionBy}) and is now assigned to you for processing.

Return Request Details:
---------------------------------------------
Return ID: ${params.returnId}
Employee: ${params.employeeName}
Asset: ${asset}
Manager Remarks: ${remarks}
---------------------------------------------

Action Required:
Please process the return and confirm the asset hand-off in the Allocation Team dashboard.

Best Regards,
Asset Management System
        `.trim();
        break;

      case 'am_rejected':
        recipientName = params.employeeName;
        subject = `[Return Request] Rejected by Asset Manager: ${params.returnId}`;
        body = `
Dear ${params.employeeName},

Your return request has been reviewed and rejected by the Asset Manager (${actionBy}).

Return Request Details:
---------------------------------------------
Return ID: ${params.returnId}
Asset: ${asset}
Status: Rejected
Rejection Reason: ${remarks}
---------------------------------------------

If you believe this was in error, please contact the Asset Manager or submit a new return request with updated details.

Best Regards,
Asset Management System
        `.trim();
        break;

      case 'alloc_approved':
        recipientName = params.nextApproverName || 'Asset Manager';
        subject = `[Return Request] Allocation Team Processed: ${params.returnId}`;
        body = `
Dear ${recipientName},

The Allocation Team (${actionBy}) has processed the return request and confirmed the asset hand-off.

Return Request Details:
---------------------------------------------
Return ID: ${params.returnId}
Employee: ${params.employeeName}
Asset: ${asset}
Allocation Remarks: ${remarks}
---------------------------------------------

Action Required:
Please provide the final confirmation in your dashboard to close this return request.

Best Regards,
Asset Management System
        `.trim();
        break;

      case 'alloc_rejected':
        recipientName = params.employeeName;
        subject = `[Return Request] Rejected by Allocation Team: ${params.returnId}`;
        body = `
Dear ${params.employeeName},

Your return request has been reviewed and rejected by the Allocation Team (${actionBy}).

Return Request Details:
---------------------------------------------
Return ID: ${params.returnId}
Asset: ${asset}
Status: Rejected
Rejection Reason: ${remarks}
---------------------------------------------

If you still wish to return this asset, please submit a new return request.

Best Regards,
Asset Management System
        `.trim();
        break;

      case 'completed':
        recipientName = params.employeeName;
        subject = `[Return Request] Completed: ${params.returnId}`;
        body = `
Dear ${params.employeeName},

Your return request has been fully processed and completed.

Return Request Details:
---------------------------------------------
Return ID: ${params.returnId}
Asset: ${asset}
Status: Completed
Final Remarks: ${remarks}
---------------------------------------------

The asset has been successfully returned and records have been updated. No further action is required.

Best Regards,
Asset Management System
        `.trim();
        break;
    }

    try {
      await this.sendSoapEmail(testEmail, recipientName, subject, body);
      console.log(`[MailService] Return notification (${params.stage}) sent successfully`);
    } catch (err) {
      console.error(`[MailService] Failed to send return notification (${params.stage}):`, err);
    }
  }



  /**
   * Helper to send a raw SOAP email via Cordys WelcomeEmail_BPM activity.

   */
  private async sendSoapEmail(to: string, name: string, subject: string, body: string): Promise<void> {
    const soap = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <WelcomeEmail_BPM xmlns="http://schemas.cordys.com/default">
      <toemail>${this.xmlEscape(to)}</toemail>
      <toname>${this.xmlEscape(name)}</toname>
      <subject>${this.xmlEscape(subject)}</subject>
      <body>${this.xmlEscape(body)}</body>
    </WelcomeEmail_BPM>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soap);

      // Check for SOAP Fault within a successful AJAX response
      const fault = this.hs.xmltojson(resp, 'Fault');
      if (fault) {
        const faultString = fault.faultstring || fault.Faultstring || JSON.stringify(fault);
        throw new Error(`Cordys SOAP Fault: ${faultString}`);
      }

      console.log(`[MailService] SOAP Email sent to ${to}`);
    } catch (err: any) {
      console.error(`[MailService] Failed to send SOAP Email to ${to}`, err);
      let detail = err?.message || err?.responseText || err?.errorThrown || '';
      if (typeof detail !== 'string') detail = JSON.stringify(err);
      throw new Error(`Email Dispatch Failed for ${to}: ${detail}`);
    }
  }


  /**
   * Sends a notification email to the team leader about a new asset request.
   */
  async sendAssetRequestToTeamLead(params: {
    teamLeadName: string;
    teamLeadEmail: string;
    employeeName: string;
    assetType: string;
    category: string;
    requestId: string;
    justification: string;
  }): Promise<void> {
    console.log('[MailService] sendAssetRequestToTeamLead:', params);

    const templateParams: Record<string, string> = {
      name: params.teamLeadName,
      userName: params.teamLeadName,
      to_email: 'sourabhsharma8151@gmail.com',
      email: `Request by: ${params.employeeName} | Asset: ${params.assetType} | Category: ${params.category}`,
      password: `Request ID: ${params.requestId} | Reason: ${params.justification}`,
      loginUrl: window.location.origin + '/team-lead/dashboard'
    };

    return this.sendEmail(MailService.TEMPLATES.ASSET_REQUEST, templateParams);
  }
}
