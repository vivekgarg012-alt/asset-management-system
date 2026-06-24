import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Asset, AssetType, AssetStatus, AssetCondition, AssetCategory } from '../models/asset.model';
import { HeroService } from './hero.service';
declare var $: any;
@Injectable({ providedIn: 'root' })
export class AssetService {
  constructor(private hs: HeroService) { }
  private assetsLoaded = false;
  private assets: Asset[] = [];

  private categories: AssetCategory[] = [];

  // constructor(private hs: HeroService) {}

  // Stores raw asset detail records from Getassetdetails (for "Provide Asset" dropdown)
  private assetDetailRecords: any[] = [];

  /**
   * Fetches asset details from the Cordys SOAP service (Getassetdetails).
   * Used for the "Provide Asset" dropdown — returns lightweight asset records.
   */
  async fetchAssetDetailsFromService(): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <Getassetdetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(response, 'tuple');

      if (!tuples) {
        console.warn('No tuples found in Getassetdetails response');
        this.assetDetailRecords = [];
        return [];
      }

      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];

      this.assetDetailRecords = tupleArray.map((tuple: any) => {
        const data = tuple?.old?.m_assets || tuple?.m_assets || tuple;
        return {
          asset_id: data?.asset_id || '',
          asset_name: data?.asset_name || '',
          type_id: data?.type_id || '',
          sub_category_id: data?.sub_category_id || '',
          serial_number: this.getNullableValue(data?.serial_number) || '',
          purchase_date: data?.purchase_date || '',
          warranty_expiry: data?.warranty_expiry || '',
          status: data?.status || '',
          temp1: this.getNullableValue(data?.temp1) || '',
          temp2: this.getNullableValue(data?.temp2) || '',
          temp3: this.getNullableValue(data?.temp3) || '',
          temp4: this.getNullableValue(data?.temp4) || '',
          temp5: this.getNullableValue(data?.temp5) || '',
          temp6: this.getNullableValue(data?.temp6) || '',
          temp7: this.getNullableValue(data?.temp7) || '',
          temp8: this.getNullableValue(data?.temp8) || ''
        };
      });

      console.log(`Fetched ${this.assetDetailRecords.length} asset details from Getassetdetails`);
      return [...this.assetDetailRecords];
    } catch (err) {
      console.error('Failed to fetch asset details from Getassetdetails:', err);
      throw err;
    }
  }

  async fetchAllRawAssets(): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <Getallassetdetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(resp, 'tuple');
      if (!tuples) return [];
      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];

      return tupleArray.map((tuple: any) => {
        const data = tuple?.old?.m_assets || tuple?.m_assets || tuple;
        return {
          asset_id: data?.asset_id || '',
          asset_name: data?.asset_name || '',
          type_id: data?.type_id || '',
          sub_category_id: data?.sub_category_id || '',
          serial_number: this.getNullableValue(data?.serial_number) || '',
          purchase_date: data?.purchase_date || '',
          warranty_expiry: data?.warranty_expiry || '',
          status: data?.status || '',
          temp1: this.getNullableValue(data?.temp1) || '',
          temp2: this.getNullableValue(data?.temp2) || '',
          temp3: this.getNullableValue(data?.temp3) || '',
          temp4: this.getNullableValue(data?.temp4) || '',
          temp5: this.getNullableValue(data?.temp5) || '',
          temp6: this.getNullableValue(data?.temp6) || '',
          temp7: this.getNullableValue(data?.temp7) || '',
          temp8: this.getNullableValue(data?.temp8) || ''
        };
      });
    } catch (err) {
      console.error('Failed to fetch all raw assets:', err);
      return [];
    }
  }

  async releaseAsset(asset: any, status: string = 'Available'): Promise<void> {
    const isReleased = (status === 'Available');
    const temp1Xml = isReleased
      ? '            <temp1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />'
      : (asset.temp1 ? `            <temp1>${asset.temp1}</temp1>` : '            <temp1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />');
    const temp2Xml = isReleased
      ? '            <temp2 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />'
      : (asset.temp2 ? `            <temp2>${asset.temp2}</temp2>` : '            <temp2 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />');

    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_assets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_assets qConstraint="0">
            <asset_id>${asset.asset_id}</asset_id>
          </m_assets>
        </old>
        <new>
          <m_assets qAccess="0" qConstraint="0" qInit="0" qValues="">
            <asset_id>${asset.asset_id}</asset_id>
            <asset_name>${asset.asset_name}</asset_name>
            <type_id>${asset.type_id}</type_id>
            <sub_category_id>${asset.sub_category_id}</sub_category_id>
            <serial_number>${asset.serial_number || ''}</serial_number>
            <purchase_date>${asset.purchase_date || ''}</purchase_date>
            <warranty_expiry>${asset.warranty_expiry || ''}</warranty_expiry>
            <status>${status}</status>
${temp1Xml}
${temp2Xml}
            <temp3>${asset.temp3 || ''}</temp3>
            <temp4>${asset.temp4 || ''}</temp4>
            <temp5>${asset.temp5 || ''}</temp5>
            <temp6>${asset.temp6 || ''}</temp6>
            <temp7>${asset.temp7 || ''}</temp7>
            <temp8>${asset.temp8 || asset.notes || ''}</temp8>
          </m_assets>
        </new>
      </tuple>
    </UpdateM_assets>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapMsg);
      console.log(`Asset ${asset.asset_id} marked as ${status}.`);
    } catch (err) {
      console.error(`Failed to release asset ${asset.asset_id}:`, err);
      throw err;
    }
  }

  async updateTDefectiveAssets(defectiveAsset: any): Promise<void> {
    const sequence = [
      'defect_id', 'asset_id', 'asset_code', 'asset_name', 'user_id', 'user_name',
      'allocation_id', 'defect_reported_date', 'defect_type', 'defect_description',
      'severity', 'reported_by', 'approved_by', 'approval_status', 'repairable',
      'repair_status', 'vendor_name', 'repair_cost', 'repaired_date', 'replacement_asset_id',
      'disposal_date', 'disposal_reason', 'remarks', 'created_date', 'updated_date',
      'temp1', 'temp2', 'temp3', 'temp4', 'temp5'
    ];

    const xmlTags = sequence
      .filter(key => {
        const val = defectiveAsset[key];
        return val !== undefined && val !== null && val !== '';
      })
      .map(key => {
        const val = defectiveAsset[key];
        return `            <${key}>${val}</${key}>`;
      })
      .join('\n');

    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateT_defective_assets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <t_defective_assets qAccess="0" qConstraint="0" qInit="0" qValues="">
${xmlTags}
          </t_defective_assets>
        </new>
      </tuple>
    </UpdateT_defective_assets>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapMsg);
      console.log(`Defect logged in t_defective_assets for asset ${defectiveAsset.asset_id}.`);
    } catch (err) {
      console.error(`Failed to update t_defective_assets for asset ${defectiveAsset.asset_id}:`, err);
      throw err;
    }
  }

  async updateAssetTemp3(assetId: string, temp3Value: string): Promise<void> {
    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_assets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_assets qConstraint="0">
            <asset_id>${assetId}</asset_id>
          </m_assets>
        </old>
        <new>
          <m_assets qAccess="0" qConstraint="0" qInit="0" qValues="">
            <asset_id>${assetId}</asset_id>
            <temp3>${temp3Value}</temp3>
          </m_assets>
        </new>
      </tuple>
    </UpdateM_assets>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapMsg);
      console.log(`Asset ${assetId} temp3 updated to ${temp3Value}.`);
    } catch (err) {
      console.error(`Failed to update temp3 for asset ${assetId}:`, err);
      throw err;
    }
  }

  async updateAssetStatus(assetId: string, status: string): Promise<void> {
    const soapMsg = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_assets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_assets qConstraint="0">
            <asset_id>${assetId}</asset_id>
          </m_assets>
        </old>
        <new>
          <m_assets qAccess="0" qConstraint="0" qInit="0" qValues="">
            <asset_id>${assetId}</asset_id>
            <status>${status}</status>
          </m_assets>
        </new>
      </tuple>
    </UpdateM_assets>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapMsg);
      console.log(`Asset ${assetId} status updated to ${status}.`);
    } catch (err) {
      console.error(`Failed to update status for asset ${assetId}:`, err);
      throw err;
    }
  }

  /**
   * Returns the stored asset detail records from the last Getassetdetails call.
   */
  getAssetDetailRecords(): any[] {
    return [...this.assetDetailRecords];
  }

  /**
   * Finds a specific asset detail record by asset_id.
   */
  getAssetDetailById(assetId: string): any | undefined {
    return this.assetDetailRecords.find(a => a.asset_id === assetId);
  }

   /**
    * Fetches allocated asset details from the Cordys SOAP service (Getallocatedasset).
    */
   async fetchAllocatedAssetsFromService(): Promise<any[]> {
     const soapRequest = `
 <SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
   <SOAP:Body>
     <Getallocatedasset xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
   </SOAP:Body>
 </SOAP:Envelope>`.trim();
 
     try {
       const response = await this.hs.ajax(null, null, {}, soapRequest);
       const tuples = this.hs.xmltojson(response, 'tuple');
 
       if (!tuples) {
         console.warn('No tuples found in Getallocatedasset response');
         return [];
       }
 
       const tupleArray = Array.isArray(tuples) ? tuples : [tuples];
 
       const allocatedAssets = tupleArray.map((tuple: any) => {
         const data = tuple?.old?.m_assets || tuple?.m_assets || tuple;
         return {
           asset_id: data?.asset_id || '',
           asset_name: data?.asset_name || '',
           type_id: data?.type_id || '',
           sub_category_id: data?.sub_category_id || '',
           serial_number: this.getNullableValue(data?.serial_number) || '',
           purchase_date: data?.purchase_date || '',
           warranty_expiry: data?.warranty_expiry || '',
           status: data?.status || '',
           temp1: data?.temp1 || ''
         };
       });
 
       console.log(`Fetched ${allocatedAssets.length} allocated assets from Getallocatedasset`);
       return allocatedAssets;
     } catch (err) {
       console.error('Failed to fetch allocated assets from Getallocatedasset:', err);
       throw err;
     }
   }
   async fetchAllocationTeamAssetsFromService(): Promise<any[]> {
     const soapRequest = `
 <SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <Getmovetoallocatedasset xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();
 
     try {
       const response = await this.hs.ajax(null, null, {}, soapRequest);
       const tuples = this.hs.xmltojson(response, 'tuple');
 
       if (!tuples) {
         console.warn('No tuples found in Getallocatedasset response');
         return [];
       }
 
       const tupleArray = Array.isArray(tuples) ? tuples : [tuples];
 
       const allocationTeamAssets = tupleArray.map((tuple: any) => {
         const data = tuple?.old?.m_assets || tuple?.m_assets || tuple;
         return {
           asset_id: data?.asset_id || '',
           asset_name: data?.asset_name || '',
           type_id: data?.type_id || '',
           sub_category_id: data?.sub_category_id || '',
           serial_number: this.getNullableValue(data?.serial_number) || '',
           purchase_date: data?.purchase_date || '',
           warranty_expiry: data?.warranty_expiry || '',
           status: data?.status || ''
         };
       });
 
       console.log(`Fetched ${allocationTeamAssets.length} Move to Allocation Team assets from Getmovetoallocatedasset`);
       return allocationTeamAssets;
     } catch (err) {
       console.error('Failed to fetch Move to Allocation Team assets from Getmovetoallocatedasset:', err);
       throw err;
     }
   }
 
   /**
    * Fetches asset counts grouped by type from the Cordys SOAP service (GetAssetTypeWiseCount).
    * Returns: [{ type_id, type_name, asset_count }]
   */
  async fetchAssetTypeWiseCount(): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAssetTypeWiseCount xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(response, 'tuple');

      if (!tuples) {
        console.warn('No tuples found in GetAssetTypeWiseCount response');
        return [];
      }

      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];

      const result = tupleArray.map((tuple: any) => {
        const data = tuple?.old?.m_asset_types || tuple?.m_asset_types || tuple;
        return {
          type_id: data?.type_id || '',
          type_name: data?.type_name || '',
          asset_count: parseInt(data?.asset_count, 10) || 0
        };
      });

      console.log(`Fetched ${result.length} type-wise counts from GetAssetTypeWiseCount`);
      return result;
    } catch (err) {
      console.error('Failed to fetch asset type-wise count:', err);
      throw err;
    }
  }

  /**
   * Fetches dashboard data from the Cordys SOAP service (GetDashboardData).
   * Returns sub-category counts: [{ name, asset_count }]
   * The caller can aggregate by type on the frontend.
   */
  async fetchDashboardData(): Promise<{ name: string; asset_count: number }[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetDashboardData xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(response, 'tuple');

      if (!tuples) {
        console.warn('No tuples found in GetDashboardData response');
        return [];
      }

      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];

      const result = tupleArray.map((tuple: any) => {
        const data = tuple?.old?.m_asset_subcategories || tuple?.m_asset_subcategories || tuple;
        return {
          name: data?.name || '',
          asset_count: parseInt(data?.asset_count, 10) || 0
        };
      });

      console.log(`Fetched ${result.length} subcategory counts from GetDashboardData`, result);
      return result;
    } catch (err) {
      console.error('Failed to fetch dashboard data from GetDashboardData:', err);
      throw err;
    }
  }

  /**
   * Fetches software subcategory counts from the Cordys SOAP service (GetSoftwareTypeData).
   * Returns: [{ name, asset_count }]
   */
  async fetchSoftwareTypeData(): Promise<{ name: string; asset_count: number }[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetSoftwareTypeData xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(response, 'tuple');

      if (!tuples) {
        console.warn('No tuples found in GetSoftwareTypeData response');
        return [];
      }

      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];

      const result = tupleArray.map((tuple: any) => {
        const data = tuple?.old?.m_asset_subcategories || tuple?.m_asset_subcategories || tuple;
        return {
          name: data?.name || '',
          asset_count: parseInt(data?.asset_count, 10) || 0
        };
      });

      console.log(`Fetched ${result.length} software subcategory counts from GetSoftwareTypeData`, result);
      return result;
    } catch (err) {
      console.error('Failed to fetch software type data from GetSoftwareTypeData:', err);
      throw err;
    }
  }

  /**
   * Fetches all asset details from the Cordys SOAP service (Getallassetdetails).
   * Parses the XML/JSON response and maps each tuple into the Asset model.
   */
  async fetchAssetsFromService(): Promise<Asset[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <Getallassetdetails xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(response, 'tuple');

      if (!tuples) {
        console.warn('No tuples found in Getallassetdetails response');
        this.assets = [];
        this.assetsLoaded = true;
        return [];
      }

      // Ensure tuples is always an array (single result comes as object)
      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];

      this.assets = tupleArray.map((tuple: any) => this.mapTupleToAsset(tuple));
      this.categories = this.buildCategoriesFromAssets(this.assets);
      this.assetsLoaded = true;

      console.log(`Fetched ${this.assets.length} assets from service`);
      return [...this.assets];
    } catch (err) {
      console.error('Failed to fetch assets from Getallassetdetails:', err);
      throw err;
    }
  }

  /**
   * Maps a single tuple from the SOAP response to the Asset interface.
   * The response structure is: tuple > old > m_assets
   */
  private mapTupleToAsset(tuple: any): Asset {
    const assetData = tuple?.old?.m_assets || tuple?.m_assets || tuple;

    // Extract nested type info
    const typeInfo = assetData?.m_asset_types || {};
    const subCatInfo = assetData?.m_asset_subcategories || {};

    // Map type_name to AssetType enum
    const typeName = typeInfo?.type_name || assetData?.asset_type || assetData?.type_id || assetData?.type || '';
    const assetType = this.mapToAssetType(typeName);

    // Map status string to AssetStatus enum
    const statusStr = assetData?.status || '';
    const assetStatus = this.mapToAssetStatus(statusStr);

    // Extract user info if joined in the response
    const userData = assetData?.m_users || tuple?.old?.m_users || tuple?.m_users || {};
    const userName = userData?.name || userData?.user_name || assetData?.assigned_to_name || assetData?.assignedToName;
    const userId = userData?.user_id || userData?.id || assetData?.assigned_to || assetData?.temp1 || assetData?.assignedTo;

    return {
      id: assetData?.asset_id || '',
      assetId: assetData?.asset_id || '',
      assetTag: assetData?.asset_id || '',
      name: assetData?.asset_name || '',
      type: assetType,
      category: subCatInfo?.name || '',
      subCategory: subCatInfo?.name || '',
      status: statusStr,
      assignedTo: this.getNullableValue(userId),
      assignedToName: this.getNullableValue(userName),
      department: this.getNullableValue(assetData?.department),
      team: this.getNullableValue(assetData?.team),
      location: this.getNullableValue(assetData?.location) || '',
      purchaseDate: assetData?.purchase_date || '',
      warrantyExpiry: assetData?.warranty_expiry || '',
      vendor: this.getNullableValue(assetData?.vendor) || '',
      serialNumber: this.getNullableValue(assetData?.serial_number) || '',
      specifications: this.getNullableValue(assetData?.specifications),
      cost: parseFloat(assetData?.cost) || 0,
      condition: this.mapToAssetCondition(this.getNullableValue(assetData?.condition) || 'Good'),
      notes: this.getNullableValue(assetData?.temp8),
      requestId: this.getNullableValue(assetData?.temp2),
      reminderDays: parseInt(this.getNullableValue(assetData?.temp3) || '30'),
      temp3: this.getNullableValue(assetData?.temp3),
      temp5: this.getNullableValue(assetData?.temp5),
      allocatedDate: assetData?.temp4 || '',
      temp8: this.getNullableValue(assetData?.temp8)
    };
  }

  /**
   * Handles null/xsi:nil values from the SOAP response.
   * Returns undefined if the value is null/nil/empty object.
   */
  private getNullableValue(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'object' && value !== null) {
      // xsi:nil="true" values come as objects with null attribute
      if (value['@nil'] === 'true' || value['@null'] === 'true') return undefined;
      return undefined;
    }
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return String(value);
  }

  private mapToAssetType(typeName: string): AssetType | string {
    const normalized = typeName.toLowerCase().trim();
    if (normalized.includes('hardware')) return AssetType.HARDWARE;
    if (normalized.includes('software')) return AssetType.SOFTWARE;
    if (normalized.includes('network')) return AssetType.NETWORK;
    if (normalized.includes('peripheral')) return AssetType.PERIPHERAL;
    if (normalized.includes('furniture')) return AssetType.FURNITURE;
    return typeName || AssetType.HARDWARE; // Preserve original name if possible
  }

  private buildCategoriesFromAssets(assets: Asset[]): AssetCategory[] {
    const categoryMap = new Map<string, AssetCategory>();

    assets.forEach(asset => {
      const categoryName = asset.category || asset.subCategory || 'Uncategorized';
      const key = `${asset.type}-${categoryName}`.toLowerCase();

      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          id: this.toCategoryId(categoryName, categoryMap.size + 1),
          name: categoryName,
          type: asset.type,
          subCategories: [asset.subCategory || categoryName],
          icon: this.getCategoryIcon(asset.type)
        });
        return;
      }

      const category = categoryMap.get(key)!;
      const subCategory = asset.subCategory || categoryName;
      if (!category.subCategories.includes(subCategory)) {
        category.subCategories.push(subCategory);
      }
    });

    return Array.from(categoryMap.values());
  }

  private toCategoryId(name: string, index: number): string {
    const normalizedName = name
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
    return normalizedName || `CAT_${String(index).padStart(3, '0')}`;
  }

  private getCategoryIcon(type: AssetType | string): string {
    const iconMap: Record<string, string> = {
      [AssetType.HARDWARE]: 'laptop_mac',
      [AssetType.SOFTWARE]: 'apps',
      [AssetType.NETWORK]: 'router',
      [AssetType.PERIPHERAL]: 'keyboard',
      [AssetType.FURNITURE]: 'chair'
    };

    return iconMap[type] || 'category';
  }

  private mapToAssetStatus(status: any): string {
    if (status === null || status === undefined) return 'Available';
    if (typeof status === 'object') return 'Available';
    return String(status);
  }

  private mapToAssetCondition(condition: string): AssetCondition {
    const normalized = condition.toLowerCase();
    if (normalized.includes('new')) return AssetCondition.NEW;
    if (normalized.includes('good')) return AssetCondition.GOOD;
    if (normalized.includes('fair')) return AssetCondition.FAIR;
    if (normalized.includes('poor')) return AssetCondition.POOR;
    if (normalized.includes('damaged')) return AssetCondition.DAMAGED;
    return AssetCondition.GOOD; // default fallback
  }

  getAssets(): Asset[] {
    return [...this.assets];
  }

  isLoaded(): boolean {
    return this.assetsLoaded;
  }

  getAssetById(id: string): Asset | undefined {
    return this.assets.find(a => a.id === id);
  }

  getAssetsByUser(userId: string): Asset[] {
    return this.assets.filter(a => a.assignedTo === userId);
  }

  async getAssetsByUserIdFromCordys(userId: string): Promise<Asset[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllocationBasedOnUser xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="">
      <userId>${userId}</userId>
    </GetAllocationBasedOnUser>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);

      // We look for multiple possible tags based on common Cordys patterns
      let data = this.hs.xmltojson(resp, 'ts_asset_allocation') ||
        this.hs.xmltojson(resp, 'GetAllocationBasedOnUser') ||
        this.hs.xmltojson(resp, 'tuple') ||
        this.hs.xmltojson(resp, 'm_assets') ||
        this.hs.xmltojson(resp, 'objects');

      if (!data) return [];

      if (!Array.isArray(data)) data = [data];

      const assetPromises = data.map(async (item: any) => {
        // Deep extract if nested in tuple/new/old (Cordys DB metadata pattern)
        const row = item.new ? item.new : (item.old ? item.old : item);
        const actualItem = row.ts_asset_allocation || row.t_asset_allocations || row.GetAllocationBasedOnUser || row;

        // Try all common variations of ID
        const assetId = actualItem.Asset_id || actualItem.asset_id || actualItem.id || actualItem.AssetId;

        // Extract the allocation date from the allocation table (ts_asset_allocations)
        const allocationDate = actualItem.assigned_date || actualItem.Assigned_date || actualItem.Assign_date || actualItem.assign_date;

        console.log('[AssetService Debug] Processing allocation item:', actualItem);

        const isMissingName = !actualItem.Asset_name && !actualItem.asset_name && !actualItem.name;
        const isMissingType = !actualItem.Asset_type && !actualItem.asset_type && !actualItem.type;
        const isMissingCategory = !actualItem.Category && !actualItem.category && !actualItem.Sub_category && !actualItem.sub_category && !actualItem.subCategory;

        // If the allocation entry is missing basic details, type, or category, fetch the full asset object
        if ((isMissingName || isMissingType || isMissingCategory) && assetId) {
          console.log(`[AssetService Debug] Fetching details for Asset ID: ${assetId} because core fields are missing`);
          // Fast lookup in memory first if available
          let detailedAsset = this.assets.find(a => a.id === assetId || a.assetId === assetId);
          
          if (!detailedAsset) {
             detailedAsset = await this.getAssetDetails(assetId) || undefined;
          }

          if (detailedAsset) {
            console.log('[AssetService Debug] Detailed asset fetched/found:', detailedAsset);
            // Merge allocation info with asset details, ensuring allocation date wins
            return {
              ...detailedAsset,
              assignedTo: actualItem.User_id || actualItem.user_id || actualItem.assignedTo || userId,
              purchaseDate: allocationDate || detailedAsset.purchaseDate
            };
          }
        }

        return {
          id: assetId || `AST-${Math.random().toString(36).substring(2, 11)}`,
          assetTag: actualItem.Asset_tag || actualItem.asset_tag || actualItem.assetTag || 'N/A',
          name: actualItem.Asset_name || actualItem.asset_name || actualItem.name || 'Unknown Asset',
          type: (actualItem.Asset_type || actualItem.asset_type || actualItem.type) as AssetType || AssetType.HARDWARE,
          category: actualItem.Category || actualItem.category || 'N/A',
          subCategory: actualItem.Sub_category || actualItem.sub_category || actualItem.subCategory || 'N/A',
          status: AssetStatus.ALLOCATED,
          assignedTo: actualItem.User_id || actualItem.user_id || actualItem.assignedTo || userId,
          assignedToName: actualItem.User_name || actualItem.user_name || actualItem.assignedToName || '',
          location: actualItem.Location || actualItem.location || 'N/A',
          purchaseDate: allocationDate || actualItem.Purchase_date || actualItem.purchase_date || actualItem.purchaseDate || '',
          warrantyExpiry: actualItem.Warranty_expiry || actualItem.warranty_expiry || actualItem.warrantyExpiry || '',
          vendor: actualItem.Vendor || actualItem.vendor || actualItem.vendor || 'N/A',
          serialNumber: actualItem.Serial_number || actualItem.serial_number || actualItem.serialNumber || 'N/A',
          requestId: actualItem.request_id || actualItem.temp2 || actualItem.temp1 || actualItem.temp3 || row.t_asset_requests?.request_id || '',
          cost: Number(actualItem.Cost || actualItem.cost || 0),
          condition: (actualItem.Condition || actualItem.condition) as AssetCondition || AssetCondition.GOOD,
          specifications: actualItem.Specifications || actualItem.specifications || '',
          allocatedDate: allocationDate || actualItem.temp4 || ''
        };
      });

      return Promise.all(assetPromises);
    } catch (error) {
      console.error('Error fetching assets from Cordys:', error);
      return [];
    }
  }

  async getAllocatedAssetsByUserId(userId: string): Promise<Asset[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllocatedAssetsByUserId xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="">
      <userId>${userId}</userId>
    </GetAllocatedAssetsByUserId>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const response = await this.hs.ajax(null, null, {}, soapRequest);
      const tuples = this.hs.xmltojson(response, 'tuple');
      if (!tuples) return [];
      const tupleArray = Array.isArray(tuples) ? tuples : [tuples];
      
      return tupleArray.map((tuple: any) => {
        const data = tuple?.old?.m_assets || tuple?.m_assets || tuple;
        const old = tuple?.old || tuple;
        
        // Extract Request ID from all possible sources (including parent structures and children)
        const requestId = data.request_id || 
                          data.requestId ||
                          data.temp2 || 
                          old.t_asset_requests?.request_id || 
                          old.t_asset_requests?.requestId ||
                          old.ts_asset_allocation?.request_id || 
                          old.ts_asset_allocation?.temp2 || 
                          old.ts_asset_allocation?.requestId ||
                          data.ts_asset_allocation?.request_id ||
                          data.t_asset_requests?.request_id ||
                          '';

        // Extract type robustly
        const typeInfo = data.m_asset_types || old.m_asset_types || data.type_info || {};
        const typeName = typeInfo.type_name || data.asset_type || data.type_id || data.type || '';
        
        // Extract category robustly
        const subCatInfo = data.m_asset_subcategories || old.m_asset_subcategories || data.subcategory_info || {};
        const catName = subCatInfo.name || data.category || data.sub_category_id || data.sub_category || '';

        return {
          id: data.asset_id || data.id || '',
          assetTag: data.serial_number || data.asset_tag || data.asset_id || '',
          name: data.asset_name || data.name || 'Unknown Asset',
          type: typeName,
          category: catName,
          subCategory: catName,
          status: data.status || 'Allocated',
          warrantyExpiry: data.warranty_expiry || data.warrantyExpiry || '',
          purchaseDate: data.purchase_date || data.purchaseDate || '',
          allocatedDate: data.temp4 || old?.m_assets?.temp4 || old?.ts_asset_allocation?.allocation_date || '',
          vendor: data.m_asset_vendors?.name || data.vendor || '',
          serialNumber: data.serial_number || '',
          requestId: requestId
        } as Asset;
      });
    } catch (err) {
      console.error('Error fetching allocated assets for My Assets section:', err);
      return [];
    }
  }

  async getAssetDetails(assetId: string): Promise<Asset | null> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetM_assetsObject xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="">
      <Asset_id>${assetId}</Asset_id>
    </GetM_assetsObject>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      const data = this.hs.xmltojson(resp, 'm_assets') || this.hs.xmltojson(resp, 'GetM_assetsObject');
      if (!data) return null;

      const row = data.new ? data.new : (data.old ? data.old : data);
      const item = row.m_assets || row;

      let typeName = item.type_id || item.Type_id || item.Asset_type || item.asset_type || item.type || 'Hardware';

      return {
        id: item.Asset_id || item.asset_id || item.id,
        assetTag: item.Asset_tag || item.asset_tag || item.assetTag || 'N/A',
        name: item.Asset_name || item.asset_name || item.name || 'Unknown Asset',
        type: typeName as AssetType,
        category: item.sub_category_id || item.Sub_category_id || item.Category || item.category || 'N/A',
        subCategory: item.sub_category_id || item.Sub_category_id || item.Sub_category || item.sub_category || 'N/A',
        status: (item.Status || item.status) as AssetStatus || AssetStatus.ALLOCATED,
        location: item.Location || item.location || 'N/A',
        purchaseDate: item.Purchase_date || item.purchase_date || item.purchaseDate || '',
        warrantyExpiry: item.Warranty_expiry || item.warranty_expiry || item.warrantyExpiry || '',
        vendor: item.Vendor || item.vendor || 'N/A',
        serialNumber: item.Serial_number || item.serial_number || item.serialNumber || 'N/A',
        cost: Number(item.Cost || item.cost || 0),
        condition: (item.Condition || item.condition) as AssetCondition || AssetCondition.GOOD,
        specifications: item.Specifications || item.specifications || '',
        allocatedDate: item.temp4 || item.Temp4 || '',
        temp3: item.temp3 || item.Temp3 || '',
        notes: item.temp8 || item.Temp8 || '',
        temp8: item.temp8 || item.Temp8 || ''
      };
    } catch (error) {
      console.error('Error fetching asset details:', error);
      return null;
    }
  }

  async getAssetTypeDetails(typeId: string): Promise<string> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetM_asset_typesObject xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="">
      <Type_id>${typeId}</Type_id>
    </GetM_asset_typesObject>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      const data = this.hs.xmltojson(resp, 'm_asset_types') || this.hs.xmltojson(resp, 'GetM_asset_typesObject');
      if (!data) return typeId;

      const row = data.new ? data.new : (data.old ? data.old : data);
      const item = row.m_asset_types || row;
      return item.type_name || item.name || typeId;
    } catch (error) {
      console.error('Error fetching asset type details:', error);
      return typeId;
    }
  }

  async getAllAssetTypesCordys(): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllAssetTypes xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      console.log('[AssetService Debug] Raw Types response:', resp);
      let data = this.hs.xmltojson(resp, 'm_asset_types') ||
        this.hs.xmltojson(resp, 'GetAllAssetTypes') ||
        this.hs.xmltojson(resp, 'tuple') ||
        this.hs.xmltojson(resp, 'Type') ||
        this.hs.xmltojson(resp, 'm_asset_type');
      if (!data) return [];
      if (!Array.isArray(data)) data = [data];
      return data.map((item: any) => {
        const row = item.new ? item.new : (item.old ? item.old : item);
        // Extract inner table object if present
        const tableObj = row.m_asset_types || row.m_asset_type || row.Type || row;
        return tableObj;
      });
    } catch (error) {
      console.error('Error fetching asset types from Cordys:', error);
      return [];
    }
  }

  async getAllCategoriesCordys(): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllAssets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      console.log('[AssetService Debug] Raw Categories/Assets response:', resp);
      let data = this.hs.xmltojson(resp, 'm_assets') ||
        this.hs.xmltojson(resp, 'GetAllAssets') ||
        this.hs.xmltojson(resp, 'tuple') ||
        this.hs.xmltojson(resp, 'Asset') ||
        this.hs.xmltojson(resp, 'm_asset');
      if (!data) return [];
      if (!Array.isArray(data)) data = [data];
      return data.map((item: any) => {
        const row = item.new ? item.new : (item.old ? item.old : item);
        const tableObj = row.m_assets || row.m_asset || row.Asset || row;
        return tableObj;
      });
    } catch (error) {
      console.error('Error fetching categories from Cordys:', error);
      return [];
    }
  }

  async getAllSubcategoriesCordys(): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAllAssetSubcategories xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="" />
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      console.log('[AssetService Debug] Raw Subcategories response:', resp);
      let data = this.hs.xmltojson(resp, 'm_asset_subcategories') ||
        this.hs.xmltojson(resp, 'm_asset_subcategory') ||
        this.hs.xmltojson(resp, 'GetAllAssetSubcategories') ||
        this.hs.xmltojson(resp, 'tuple') ||
        this.hs.xmltojson(resp, 'Subcategory');
      if (!data) return [];
      if (!Array.isArray(data)) data = [data];
      return data.map((item: any) => {
        const row = item.new ? item.new : (item.old ? item.old : item);
        const tableObj = row.m_asset_subcategories || row.m_asset_subcategory || row.Subcategory || row.Sub_category || row;
        return tableObj;
      });
    } catch (error) {
      console.error('Error fetching sub-categories from Cordys:', error);
      return [];
    }
  }

  getAssetsByType(type: AssetType): Asset[] {
    return this.assets.filter(a => a.type === type);
  }

  getAssetsByStatus(status: AssetStatus): Asset[] {
    return this.assets.filter(a => a.status === status);
  }

  getAssetsByDepartment(department: string): Asset[] {
    return this.assets.filter(a => a.department === department);
  }

  getAssetsByTeam(team: string): Asset[] {
    return this.assets.filter(a => a.team === team);
  }

  getCategories(): AssetCategory[] {
    return [...this.categories];
  }

  getCategoriesByType(type: AssetType): AssetCategory[] {
    return this.categories.filter(c => c.type === type);
  }

  addAsset(asset: Asset): void {
    this.assets.push(asset);
  }

  async addAssetType(typeId: string, typeName: string): Promise<void> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_asset_types xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <m_asset_types qAccess="0" qConstraint="0" qInit="0" qValues="">
            <type_id>${typeId}</type_id>
            <type_name>${typeName}</type_name>
          </m_asset_types>
        </new>
      </tuple>
    </UpdateM_asset_types>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapRequest);
      console.log(`Asset type ${typeName} added successfully.`);
    } catch (err) {
      console.error('Failed to add asset type:', err);
      throw err;
    }
  }

  async addAssetSubCategory(subCatId: string, name: string, typeId: string): Promise<void> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_asset_subcategories xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <m_asset_subcategories qAccess="0" qConstraint="0" qInit="0" qValues="">
            <sub_category_id>${subCatId}</sub_category_id>
            <name>${name}</name>
            <type_id>${typeId}</type_id>
          </m_asset_subcategories>
        </new>
      </tuple>
    </UpdateM_asset_subcategories>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapRequest);
      console.log(`Subcategory ${name} added successfully.`);
    } catch (err) {
      console.error('Failed to add subcategory:', err);
      throw err;
    }
  }

  async addAssetCordys(asset: Asset, typeId: string, subCatId: string): Promise<void> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_assets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <new>
          <m_assets qAccess="0" qConstraint="0" qInit="0" qValues="">
            <asset_id>${asset.id}</asset_id>
            <asset_name>${asset.name}</asset_name>
            <type_id>${typeId}</type_id>
            <sub_category_id>${subCatId}</sub_category_id>
            <serial_number>${asset.serialNumber || ''}</serial_number>
            <purchase_date>${asset.purchaseDate || ''}</purchase_date>
            <warranty_expiry>${asset.warrantyExpiry || ''}</warranty_expiry>
            <status>${asset.status || 'Available'}</status>
            <temp1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />
            <temp2 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />
            <temp3>${asset.temp3 !== undefined ? asset.temp3 : (asset.reminderDays || 30)}</temp3>
            <temp4 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true" />
            <temp5>${asset.temp5 || '0'}</temp5>
            <temp6>${asset.temp6 || '0'}</temp6>
            <temp7>${asset.temp7 || '0'}</temp7>
          </m_assets>
        </new>
      </tuple>
    </UpdateM_assets>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapRequest);
      // Remove sync local push as the refresh should fetch the latest from Cordys
      console.log(`Asset ${asset.name} added successfully.`);
    } catch (err) {
      console.error('Failed to add asset:', err);
      throw err;
    }
  }

  updateAsset(updated: Asset): void {
    const idx = this.assets.findIndex(a => a.id === updated.id);
    if (idx >= 0) this.assets[idx] = updated;
  }

  async deleteAssetTypeCordys(typeId: string): Promise<void> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_asset_types xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_asset_types>
            <type_id>${typeId}</type_id>
          </m_asset_types>
        </old>
      </tuple>
    </UpdateM_asset_types>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapRequest);
      console.log(`Asset type ${typeId} deleted successfully.`);
    } catch (err) {
      console.error('Failed to delete asset type:', err);
      throw err;
    }
  }

  async deleteAssetSubCategoryCordys(subCatId: string): Promise<void> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_asset_subcategories xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_asset_subcategories>
            <sub_category_id>${subCatId}</sub_category_id>
          </m_asset_subcategories>
        </old>
      </tuple>
    </UpdateM_asset_subcategories>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapRequest);
      console.log(`Subcategory ${subCatId} deleted successfully.`);
    } catch (err) {
      console.error('Failed to delete subcategory:', err);
      throw err;
    }
  }

  async deleteAssetCordys(assetId: string): Promise<void> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <UpdateM_assets xmlns="http://schemas.cordys.com/AMS_Database_Metadata" reply="yes" commandUpdate="no" preserveSpace="no" batchUpdate="no">
      <tuple>
        <old>
          <m_assets>
            <asset_id>${assetId}</asset_id>
          </m_assets>
        </old>
      </tuple>
    </UpdateM_assets>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      await this.hs.ajax(null, null, {}, soapRequest);
      console.log(`Asset ${assetId} deleted successfully.`);
    } catch (err) {
      console.error('Failed to delete asset:', err);
      throw err;
    }
  }

  getAssetStats() {
    const assetTypes = [...new Set(this.assets.map(asset => asset.type))];
    const categoryNames = [...new Set(this.assets.map(asset => asset.category).filter(Boolean))];

    return {
      total: this.assets.length,
      available: this.assets.filter(a => String(a.status).toLowerCase().includes('available')).length,
      allocated: this.assets.filter(a => String(a.status).toLowerCase().includes('allocated')).length,
      inRepair: this.assets.filter(a => String(a.status).toLowerCase().includes('repair')).length,
      retired: this.assets.filter(a => String(a.status).toLowerCase().includes('retired')).length,
      totalValue: this.assets.reduce((sum, a) => sum + a.cost, 0),
      byType: assetTypes.map(type => ({
        type,
        count: this.assets.filter(a => a.type === type).length,
        value: this.assets.filter(a => a.type === type).reduce((s, a) => s + a.cost, 0)
      })),
      byCategory: categoryNames.map(category => ({
        category,
        type: this.assets.find(a => a.category === category)?.type,
        count: this.assets.filter(a => a.category === category).length
      })),
      warrantyExpiringSoon: this.assets.filter(a => {
        const expiry = new Date(a.warrantyExpiry);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000;
      }).length
    };
  }

  async getAssetsByUserSOAP(userId: string): Promise<any[]> {
    const soapRequest = `
<SOAP:Envelope xmlns:SOAP="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP:Body>
    <GetAssetsByUser xmlns="http://schemas.cordys.com/AMS_Database_Metadata" preserveSpace="no" qAccess="0" qValues="">
      <userId>${userId}</userId>
    </GetAssetsByUser>
  </SOAP:Body>
</SOAP:Envelope>`.trim();

    try {
      const resp = await this.hs.ajax(null, null, {}, soapRequest);
      
      let data = this.hs.xmltojson(resp, 'm_assets') ||
        this.hs.xmltojson(resp, 'GetAssetsByUserResponse') ||
        this.hs.xmltojson(resp, 'tuple');
        
      if (!data) return [];
      if (!Array.isArray(data)) data = [data];

      return data.map((item: any) => {
        const row = item.new ? item.new : (item.old ? item.old : item);
        const actualItem = row.m_assets || row;

        return {
          id: actualItem.asset_id || actualItem.Asset_id || '',
          assetTag: actualItem.asset_id || actualItem.Asset_id || '',
          name: actualItem.asset_name || actualItem.Asset_name || '',
          type: actualItem.type_id || '',
          category: actualItem.sub_category_id || '',
          subCategory: actualItem.sub_category_id || '',
          status: actualItem.status || actualItem.Status || 'Allocated',
          purchaseDate: actualItem.purchase_date || '',
          warrantyExpiry: actualItem.warranty_expiry || '',
          serialNumber: actualItem.serial_number || '',
          condition: actualItem.condition || actualItem.Condition || 'Good',
        };
      });
    } catch (error) {
      console.error('Error fetching assets by user from Cordys:', error);
      return [];
    }
  }

  getTeamWiseHolding() {
    const teamMap = new Map<string, { department: string; team: string; count: number; value: number }>();
    this.assets.filter(a => a.team).forEach(a => {
      const key = `${a.department}-${a.team}`;
      if (!teamMap.has(key)) {
        teamMap.set(key, { department: a.department!, team: a.team!, count: 0, value: 0 });
      }
      const entry = teamMap.get(key)!;
      entry.count++;
      entry.value += a.cost;
    });
    return Array.from(teamMap.values());
  }
}

