import { getAppDatabase } from './appdb';
import { ObjectId } from 'mongodb';

/**
 * Get all organizations a user belongs to
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of organizations with member info
 */
export async function getUserOrganizations(userId) {
  const { db } = await getAppDatabase();
  const membersCollection = db.collection('organization_members');
  const organizationsCollection = db.collection('organizations');

  // Get all memberships
  const memberships = await membersCollection
    .find({ userId })
    .toArray();

  if (memberships.length === 0) {
    return [];
  }

  // Get organization details
  const organizationIds = memberships.map(m => new ObjectId(m.organizationId));
  const organizations = await organizationsCollection
    .find({ _id: { $in: organizationIds } })
    .toArray();

  // Combine with membership info
  const orgMap = {};
  organizations.forEach(org => {
    orgMap[org._id.toString()] = org;
  });

  return memberships.map(membership => {
    const org = orgMap[membership.organizationId.toString()];
    return {
      id: org._id.toString(),
      name: org.name,
      role: membership.role,
      joinedAt: membership.joinedAt,
      createdAt: org.createdAt,
    };
  });
}

/**
 * Get user's role in a specific organization
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<string|null>} Role ('admin' | 'member') or null if not a member
 */
export async function getUserRoleInOrganization(userId, organizationId) {
  const { db } = await getAppDatabase();
  const membersCollection = db.collection('organization_members');

  // Normalize organizationId to ObjectId for consistent querying
  // organizationId is stored as ObjectId in the database
  let orgIdObj;
  try {
    orgIdObj = organizationId instanceof ObjectId ? organizationId : new ObjectId(organizationId);
  } catch (e) {
    // If organizationId is not a valid ObjectId string, return null
    console.error('Invalid organizationId format:', organizationId, e);
    return null;
  }

  // Query for membership - organizationId is stored as ObjectId, userId as string
  // Try multiple query formats to handle any type mismatches
  let membership = await membersCollection.findOne({
    userId: String(userId), // Ensure userId is a string
    organizationId: orgIdObj,
  });

  // If not found, try with string organizationId (in case it was stored as string)
  if (!membership) {
    membership = await membersCollection.findOne({
      userId: String(userId),
      $or: [
        { organizationId: orgIdObj },
        { organizationId: organizationId },
        { organizationId: orgIdObj.toString() }
      ]
    });
  }

  // Debug logging (can be removed in production)
  if (!membership) {
    // Check if user exists in any organization
    const allMemberships = await membersCollection.find({ userId: String(userId) }).toArray();
    console.error('Debug getUserRoleInOrganization - membership not found:', {
      userId,
      organizationId,
      orgIdObj: orgIdObj.toString(),
      orgIdObjType: orgIdObj.constructor.name,
      foundMemberships: allMemberships.length,
      allOrgIds: allMemberships.map(m => ({
        orgId: m.organizationId?.toString(),
        orgIdType: m.organizationId?.constructor?.name,
        role: m.role
      }))
    });
  }

  return membership ? membership.role : null;
}

/**
 * Check if user is a member of an organization
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} True if user is a member
 */
export async function isOrganizationMember(userId, organizationId) {
  const role = await getUserRoleInOrganization(userId, organizationId);
  return role !== null;
}

/**
 * Check if user can perform backup operations (admin only)
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} True if user can backup
 */
export async function canPerformBackup(userId, organizationId) {
  const role = await getUserRoleInOrganization(userId, organizationId);
  return role === 'admin';
}

/**
 * Require backup permission - throws error if user cannot backup
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have backup permission
 */
export async function requireBackupPermission(userId, organizationId) {
  const canBackup = await canPerformBackup(userId, organizationId);
  if (!canBackup) {
    throw new Error('You do not have permission to perform backup operations. Only organization admins can backup.');
  }
}

/**
 * Check if user is admin of an organization
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isOrganizationAdmin(userId, organizationId) {
  const role = await getUserRoleInOrganization(userId, organizationId);
  return role === 'admin';
}

/**
 * Require admin permission - throws error if user is not admin
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<void>}
 * @throws {Error} If user is not admin
 */
export async function requireAdminPermission(userId, organizationId) {
  // Validate inputs
  if (!organizationId) {
    console.error('requireAdminPermission called with undefined organizationId');
    throw new Error('Organization ID is required');
  }
  
  if (!userId) {
    console.error('requireAdminPermission called with undefined userId');
    throw new Error('User ID is required');
  }

  const { db } = await getAppDatabase();
  const membersCollection = db.collection('organization_members');
  
  // Normalize organizationId to ObjectId
  let orgIdObj;
  try {
    orgIdObj = organizationId instanceof ObjectId ? organizationId : new ObjectId(organizationId);
  } catch (e) {
    console.error('Invalid organizationId in requireAdminPermission:', organizationId, e);
    throw new Error('Invalid organization ID');
  }

  // Direct query to check membership and role
  const membership = await membersCollection.findOne({
    userId: String(userId),
    organizationId: orgIdObj,
  });

  // Debug logging
  if (!membership) {
    // Check all memberships for this user
    const allMemberships = await membersCollection.find({ userId: String(userId) }).toArray();
    console.error('Admin permission check failed:', {
      userId,
      organizationId,
      orgIdObj: orgIdObj.toString(),
      foundMemberships: allMemberships.length,
      allOrgIds: allMemberships.map(m => ({
        orgId: m.organizationId?.toString(),
        role: m.role,
        storedOrgIdType: m.organizationId?.constructor?.name
      }))
    });
    
    // Also try to find by string comparison
    const stringMembership = await membersCollection.findOne({
      userId: String(userId),
      organizationId: organizationId,
    });
    
    if (stringMembership) {
      console.error('Found membership with string organizationId:', {
        membership: stringMembership,
        role: stringMembership.role
      });
    }
  }

  if (!membership || membership.role !== 'admin') {
    throw new Error('You do not have permission to perform this action. Only organization admins can perform this operation.');
  }
}

/**
 * Check if user can access a specific connection
 * Admins can access all connections, members need explicit permission
 * @param {string} userId - User ID
 * @param {string} connectionId - Connection ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} True if user can access the connection
 */
export async function canAccessConnection(userId, connectionId, organizationId) {
  // Admins can access all connections
  const isAdmin = await isOrganizationAdmin(userId, organizationId);
  if (isAdmin) {
    return true;
  }

  // Check if user has explicit permission
  const { db } = await getAppDatabase();
  const permissionsCollection = db.collection('connection_permissions');

  let connIdObj;
  let orgIdObj;
  try {
    connIdObj = connectionId instanceof ObjectId ? connectionId : new ObjectId(connectionId);
    orgIdObj = organizationId instanceof ObjectId ? organizationId : new ObjectId(organizationId);
  } catch (e) {
    return false;
  }

  const permission = await permissionsCollection.findOne({
    userId: String(userId),
    connectionId: connIdObj,
    organizationId: orgIdObj,
  });

  return permission !== null;
}

/**
 * Get list of connection IDs that a user can access
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array<string>>} Array of connection ID strings
 */
export async function getUserAccessibleConnections(userId, organizationId) {
  // Admins can access all connections in the organization
  const isAdmin = await isOrganizationAdmin(userId, organizationId);
  if (isAdmin) {
    const { db } = await getAppDatabase();
    const connectionsCollection = db.collection('connections');
    
    let orgIdObj;
    try {
      orgIdObj = organizationId instanceof ObjectId ? organizationId : new ObjectId(organizationId);
    } catch (e) {
      return [];
    }

    const connections = await connectionsCollection
      .find({ organizationId: orgIdObj })
      .toArray();

    return connections.map(conn => conn._id.toString());
  }

  // Members get only connections they have permission for
  const { db } = await getAppDatabase();
  const permissionsCollection = db.collection('connection_permissions');

  let orgIdObj;
  try {
    orgIdObj = organizationId instanceof ObjectId ? organizationId : new ObjectId(organizationId);
  } catch (e) {
    return [];
  }

  const permissions = await permissionsCollection
    .find({
      userId: String(userId),
      organizationId: orgIdObj,
    })
    .toArray();

  return permissions.map(perm => perm.connectionId.toString());
}

/**
 * Require connection access - throws error if user cannot access connection
 * @param {string} userId - User ID
 * @param {string} connectionId - Connection ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have access to the connection
 */
export async function requireConnectionAccess(userId, connectionId, organizationId) {
  const canAccess = await canAccessConnection(userId, connectionId, organizationId);
  if (!canAccess) {
    throw new Error('You do not have permission to access this connection.');
  }
}

/**
 * Check if user can manage connections (create/edit/delete) - admin only
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} True if user can manage connections
 */
export async function canManageConnections(userId, organizationId) {
  return await isOrganizationAdmin(userId, organizationId);
}


