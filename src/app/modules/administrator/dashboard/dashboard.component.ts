import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { AdminDataService, AssetRequest } from '../../../core/services/admin-data.service';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { Asset } from '../../../core/models/asset.model';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  userStats: any = {};
  assetStats: any = {};
  reqStats: any = {};
  activeProjects = 0;
  assetStatusSubtitle = 'Status wise distribution';
  assetSubCategorySubtitle = 'Top sub categories by count';

  assetStatusChartType: 'doughnut' = 'doughnut';
  requestTrendChartType: 'line' = 'line';
  assetCategoryChartType: 'bar' = 'bar';
  userRoleChartType: 'pie' = 'pie';

  assetStatusChartData: ChartData<'doughnut', number[], string> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  requestTrendChartData: ChartData<'line', number[], string> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  assetCategoryChartData: ChartData<'bar', number[], string> = {
    labels: [],
    datasets: [{ data: [] }]
  };
  userRoleChartData: ChartData<'pie', number[], string> = {
    labels: [],
    datasets: [{ data: [] }]
  };

  assetStatusChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  requestTrendChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    },
    plugins: {
      legend: { display: false }
    }
  };

  assetCategoryChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    },
    plugins: {
      legend: { display: false }
    }
  };

  userRoleChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  constructor(
    private assetService: AssetService,
    private adminDataService: AdminDataService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.loadDashboardData();
  }

  private async loadDashboardData(): Promise<void> {
    await this.loadAssetStats();
    const allRequests = await this.getResolvedAssetRequests();
    this.reqStats = this.getRequestStatsFromRequests(allRequests);
    this.userStats = await this.getResolvedUserStats();
    const roleStats = await this.getResolvedRoleStats();
    this.activeProjects = await this.getResolvedActiveProjectCount();

    const statusCounts = this.getStatusWiseAssetCounts(this.assetService.getAssets());
    this.assetStatusSubtitle = statusCounts.labels.join(' / ') || 'Status wise distribution';
    this.assetStatusChartData = {
      labels: statusCounts.labels,
      datasets: [
        {
          data: statusCounts.counts,
          backgroundColor: statusCounts.colors,
          borderWidth: 0
        }
      ]
    };

    const requestTrend = this.buildAssetRequestTrend(allRequests);
    this.requestTrendChartData = {
      labels: requestTrend.labels,
      datasets: [
        {
          data: requestTrend.counts,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          tension: 0.35,
          fill: true,
          pointRadius: 3
        }
      ]
    };

    const subCategoryCounts = this.getSubCategoryWiseCounts(this.assetService.getAssets());
    this.assetSubCategorySubtitle = subCategoryCounts.labels.length
      ? `${subCategoryCounts.labels.slice(0, 4).join(', ')}${subCategoryCounts.labels.length > 4 ? ', and more' : ''}`
      : 'No sub category data';
    this.assetCategoryChartData = {
      labels: subCategoryCounts.labels,
      datasets: [
        {
          data: subCategoryCounts.counts,
          backgroundColor: subCategoryCounts.colors,
          borderWidth: 0
        }
      ]
    };

    this.userRoleChartData = {
      labels: roleStats.map((item: any) => item.name),
      datasets: [
        {
          data: roleStats.map((item: any) => item.userCount),
          backgroundColor: ['#0f172a', '#2563eb', '#f59e0b', '#14b8a6', '#8b5cf6'],
          borderWidth: 0
        }
      ]
    };
  }

  private async getResolvedUserStats(): Promise<any> {
    try {
      const users = await this.adminDataService.GetAllUserRoleProjectDetails();
      return this.adminDataService.getUserStatsFromUsers(users);
    } catch (error) {
      console.error('Unable to load DB user stats for dashboard.', error);
      return this.adminDataService.getUserStatsFromUsers([]);
    }
  }

  private async getResolvedRoleStats(): Promise<Array<{ name: string; userCount: number }>> {
    try {
      return await this.adminDataService.getRolesFromDB();
    } catch (error) {
      console.error('Unable to load DB role stats for dashboard.', error);
      return [];
    }
  }

  private async getResolvedAssetRequests(): Promise<AssetRequest[]> {
    try {
      return await this.adminDataService.getAllRequests();
    } catch (error) {
      console.error('Unable to load request trend from Getallrequest service.', error);
      return [];
    }
  }

  private async loadAssetStats(): Promise<void> {
    try {
      if (!this.assetService.isLoaded()) {
        await this.assetService.fetchAssetsFromService();
      }
      this.assetStats = this.assetService.getAssetStats();
    } catch (error) {
      console.error('Unable to load asset stats for dashboard.', error);
      this.assetStats = this.assetService.getAssetStats();
    }

    this.assetStats = this.assetStats || this.assetService.getAssetStats();
  }

  private async getResolvedActiveProjectCount(): Promise<number> {
    try {
      const activeProjects = await this.adminDataService.getProjectsByStatus('Active');
      return activeProjects.length;
    } catch (error) {
      console.error('Unable to load DB project stats for dashboard.', error);
      return 0;
    }
  }

  private buildRequestTrend(requests: Array<{ requestDate: string }>): { labels: string[]; counts: number[] } {
    if (!requests.length) {
      return { labels: [], counts: [] };
    }

    const monthMap = new Map<string, number>();
    requests.forEach(request => {
      const date = new Date(request.requestDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });

    const monthKeys = [...monthMap.keys()].sort();
    const latestKey = monthKeys[monthKeys.length - 1];
    if (!latestKey) {
      return { labels: [], counts: [] };
    }

    const [latestYear, latestMonth] = latestKey.split('-').map(Number);
    const labels: string[] = [];
    const counts: number[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(latestYear, latestMonth - 1 - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`);
      counts.push(monthMap.get(key) || 0);
    }

    return { labels, counts };
  }

  private getRequestStatsFromRequests(requests: AssetRequest[]): { pending: number; total: number; approved: number; rejected: number } {
    const pending = requests.filter((request) => request.status?.toLowerCase() === 'pending').length;
    const approved = requests.filter((request) => {
      const status = request.status?.toLowerCase();
      return status === 'approved' || status === 'completed';
    }).length;
    const rejected = requests.filter((request) => request.status?.toLowerCase() === 'rejected').length;

    return {
      pending,
      total: requests.length,
      approved,
      rejected
    };
  }

  private buildAssetRequestTrend(requests: AssetRequest[]): { labels: string[]; counts: number[] } {
    if (!requests.length) {
      return { labels: [], counts: [] };
    }

    const monthMap = new Map<string, number>();
    const validDates = requests
      .map(request => new Date(request.createdAt))
      .filter(date => !Number.isNaN(date.getTime()));

    if (!validDates.length) {
      return { labels: [], counts: [] };
    }

    validDates.forEach((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });

    const latestTime = Math.max(...validDates.map(date => date.getTime()));
    const latestDate = new Date(latestTime);
    const labels: string[] = [];
    const counts: number[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(latestDate.getFullYear(), latestDate.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`);
      counts.push(monthMap.get(key) || 0);
    }

    return { labels, counts };
  }

  private getStatusWiseAssetCounts(assets: Asset[]): { labels: string[]; counts: number[]; colors: string[] } {
    const statusMap = new Map<string, number>();

    assets.forEach((asset) => {
      const normalizedStatus = this.normalizeAssetStatus(asset.status);
      statusMap.set(normalizedStatus, (statusMap.get(normalizedStatus) || 0) + 1);
    });

    const statusEntries = Array.from(statusMap.entries()).sort((a, b) => b[1] - a[1]);
    const labels = statusEntries.map(([label]) => label);
    const counts = statusEntries.map(([, count]) => count);
    const colors = labels.map((label, index) => this.getStatusColor(label, index));

    return { labels, counts, colors };
  }

  private normalizeAssetStatus(status: string): string {
    const value = (status || '').trim().toLowerCase();

    if (!value) {
      return 'Unknown';
    }

    if (value === 'move_to_allocation_team' || value === 'movetoallocationteam') {
      return 'Move To Allocation Team';
    }

    if (value === 'in_repair') {
      return 'In Repair';
    }

    return value
      .split(/[\s_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getStatusColor(status: string, fallbackIndex: number): string {
    const normalized = status.toLowerCase();
    if (normalized.includes('available')) return '#22c55e';
    if (normalized.includes('allocated')) return '#3b82f6';
    if (normalized.includes('maintenance') || normalized.includes('repair')) return '#f59e0b';
    if (normalized.includes('retired')) return '#64748b';
    if (normalized.includes('reserved')) return '#8b5cf6';
    if (normalized.includes('move to allocation')) return '#06b6d4';

    const palette = ['#10b981', '#6366f1', '#f43f5e', '#0ea5e9', '#a855f7', '#14b8a6'];
    return palette[fallbackIndex % palette.length];
  }

  private getSubCategoryWiseCounts(assets: Asset[]): { labels: string[]; counts: number[]; colors: string[] } {
    const subCategoryMap = new Map<string, number>();

    assets.forEach((asset) => {
      const subCategoryName = this.normalizeSubCategory(asset.subCategory || asset.category);
      subCategoryMap.set(subCategoryName, (subCategoryMap.get(subCategoryName) || 0) + 1);
    });

    const subCategoryEntries = Array.from(subCategoryMap.entries()).sort((a, b) => b[1] - a[1]);
    const labels = subCategoryEntries.map(([label]) => label);
    const counts = subCategoryEntries.map(([, count]) => count);
    const palette = [
      '#6366f1',
      '#0ea5e9',
      '#14b8a6',
      '#f59e0b',
      '#8b5cf6',
      '#22c55e',
      '#ef4444',
      '#64748b'
    ];
    const colors = labels.map((_, index) => palette[index % palette.length]);

    return { labels, counts, colors };
  }

  private normalizeSubCategory(value: string): string {
    const normalized = (value || '').trim();
    if (!normalized || normalized.toLowerCase() === 'null') {
      return 'Uncategorized';
    }
    return normalized;
  }
}
