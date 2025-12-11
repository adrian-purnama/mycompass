'use client';

import { useState, useEffect, useRef } from 'react';
import { FiUsers, FiChevronDown, FiCheck, FiPlus, FiMail, FiSettings } from 'react-icons/fi';

export default function OrganizationSelector({ 
  selectedOrganizationId, 
  onSelectOrganization,
  onCreateNew,
  onInvite,
  onSettings,
  refreshTrigger 
}) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const loadOrganizations = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch('/api/organizations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setOrganizations(result.organizations || []);
        // Auto-select first organization if none selected and we have organizations
        // Note: selectedOrganizationId is already loaded from localStorage in page.js
        if (!selectedOrganizationId && result.organizations && result.organizations.length > 0) {
          onSelectOrganization(result.organizations[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh when refreshTrigger changes (e.g., after creating new organization)
  useEffect(() => {
    if (refreshTrigger) {
      loadOrganizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOrg = organizations.find(org => org.id === selectedOrganizationId);

  const handleSelect = (orgId) => {
    onSelectOrganization(orgId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2 sm:px-3 flex items-center gap-1.5 sm:gap-2 text-xs font-medium rounded-md bg-card border border-border hover:bg-accent text-foreground transition-colors whitespace-nowrap max-w-[200px] sm:max-w-none shadow-sm"
        title={selectedOrg ? selectedOrg.name : 'Select Organization'}
      >
        <FiUsers size={14} className="flex-shrink-0" />
        <span className="hidden sm:inline truncate">
          {selectedOrg ? selectedOrg.name : 'No Org'}
        </span>
        <span className="sm:hidden truncate">
          {selectedOrg ? selectedOrg.name.substring(0, 8) + (selectedOrg.name.length > 8 ? '...' : '') : 'Org'}
        </span>
        <FiChevronDown 
          size={12} 
          className={`flex-shrink-0 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 sm:w-72 border border-border rounded-lg shadow-xl z-50 max-h-[400px] overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--card)' }}>
          <div className="p-2 border-b border-border space-y-2">
            <button
              onClick={() => {
                setIsOpen(false);
                onCreateNew();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <FiPlus size={14} />
              Create New Organization
            </button>
            {selectedOrganizationId && (
              <>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onInvite && onInvite();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  <FiMail size={14} />
                  Invite User
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onSettings && onSettings();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-muted text-foreground hover:bg-accent transition-colors"
                >
                  <FiSettings size={14} />
                  Settings
                </button>
              </>
            )}
          </div>
          
          <div className="overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading organizations...
              </div>
            ) : organizations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <p className="mb-2">No organizations yet</p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onCreateNew();
                  }}
                  className="text-primary hover:underline"
                >
                  Create your first organization
                </button>
              </div>
            ) : (
              <div className="p-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelect(org.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                      selectedOrganizationId === org.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FiUsers size={14} className="flex-shrink-0" />
                      <span className="truncate font-medium">{org.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        org.role === 'admin'
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {org.role}
                      </span>
                    </div>
                    {selectedOrganizationId === org.id && (
                      <FiCheck size={16} className="text-primary flex-shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

