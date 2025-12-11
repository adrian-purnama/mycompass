'use client';

import { useState, useEffect } from 'react';
import OrganizationSettings from './OrganizationSettings';

export default function OrganizationSettingsWrapper({ organizationId, onClose }) {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganization = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      try {
        const response = await fetch('/api/organizations', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (result.success) {
          const org = result.organizations.find(o => o.id === organizationId);
          if (org) {
            setOrganization(org);
          }
        }
      } catch (error) {
        console.error('Failed to load organization:', error);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      loadOrganization();
    }
  }, [organizationId]);

  if (loading || !organization) {
    return null;
  }

  return (
    <OrganizationSettings
      organization={organization}
      onClose={onClose}
    />
  );
}


