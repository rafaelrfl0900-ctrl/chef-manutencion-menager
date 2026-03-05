export type Department = 'Produção' | 'Qualidade' | 'Administrativo' | 'Outros';
export type RequestStatus = 'pending' | 'in_progress' | 'completed';

export interface ServiceRequest {
  id: string;
  date: string;
  time: string;
  requesterName: string;
  requesterDepartment: Department;
  area: string;
  description: string;
  equipment: string;
  affectsSafety: boolean;
  affectsProduction: boolean;
  status: RequestStatus;
  osNumber?: string;
  createdAt: string;
  createdBy: string;
}

export interface MaintenanceService {
  date: string;
  startTime: string;
  endTime: string;
  activity: string;
  responsible: string;
}

export interface MaintenancePart {
  initialQty: number;
  usedQty: number;
  finalQty: number;
  description: string;
}

export interface MaintenanceOrder {
  id: string;
  requestId: string;
  osNumber: string;
  date: string;
  requester: string;
  equipment: string;
  department: string;
  urgency: string;
  defectDescription: string;
  services: MaintenanceService[];
  partsUsed: MaintenancePart[];
  closure: {
    date: string;
    requesterSignature: string;
    observations: string;
  };
  hygiene: {
    date: string;
    department: string;
    equipment: string;
    qualityRelease: string;
  };
  createdAt: string;
  createdBy: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
}
