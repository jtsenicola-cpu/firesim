import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Lightweight Rapier3D rigid-body physics wrapper for Firesim.
 * Handles static structural block colliders (removed on breach/collapse),
 * dynamic tumbling rubble, burned remnants, and fallen furniture.
 */
export class PhysicsWorld {
  constructor() {
    this.ready = false;
    this.failed = false;
    this.world = null;
    this.staticBlockBodies = new Map();
    this.dynamicBodies = new Map();
    this.nextId = 1;
  }

  async init(blocks = []) {
    if (this.ready || this.failed) return this.ready;
    try {
      await RAPIER.init();
      this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
      this._createGround();
      this.syncStaticBlocks(blocks);
      this.ready = true;
    } catch (err) {
      console.warn('Rapier3D initialization failed, using fallback kinematics:', err);
      this.failed = true;
    }
    return this.ready;
  }

  _createGround() {
    if (!this.world) return;
    // Stage ground top surface sits at y = -0.18
    const groundBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.43, 0)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(30, 0.25, 30).setFriction(0.85).setRestitution(0.15),
      groundBody
    );

    // Floor 0 building slab top surface sits at y = 0.0 (footprint x: [-4.1, 4.1], z: [-2.9, 2.9])
    const floor0Body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.09, 0)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(4.1, 0.09, 2.9).setFriction(0.8).setRestitution(0.12),
      floor0Body
    );
  }

  syncStaticBlocks(blocks) {
    if (!this.world) return;
    for (const block of blocks) {
      const existing = this.staticBlockBodies.get(block.id);
      if (block.destroyed) {
        if (existing) {
          this.world.removeRigidBody(existing);
          this.staticBlockBodies.delete(block.id);
        }
        continue;
      }

      const pos = block.origPos ?? block.mesh?.position;
      const w = block.size ? block.size[0] : block.width;
      const h = block.size ? block.size[1] : block.height;
      const d = block.size ? block.size[2] : block.depth;

      if (!existing && pos && w && h && d) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
        const body = this.world.createRigidBody(bodyDesc);
        const hx = Math.max(0.05, w * 0.5);
        const hy = Math.max(0.04, h * 0.5);
        const hz = Math.max(0.05, d * 0.5);
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.75).setRestitution(0.12),
          body
        );
        this.staticBlockBodies.set(block.id, body);
      } else if (existing && block.mesh) {
        // Keep collider synced with progressive sag/tilt before collapse
        existing.setTranslation(
          { x: block.mesh.position.x, y: block.mesh.position.y, z: block.mesh.position.z },
          true
        );
        existing.setRotation(
          {
            x: block.mesh.quaternion.x,
            y: block.mesh.quaternion.y,
            z: block.mesh.quaternion.z,
            w: block.mesh.quaternion.w
          },
          true
        );
      }
    }
  }

  addDynamicBox({ pos, quat, halfExtents, vel, angVel, restitution = 0.2, friction = 0.78, density = 1.2 }) {
    if (!this.ready || !this.world) return null;
    const id = this.nextId++;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.35)
      .setAngularDamping(0.45);
    if (quat) {
      bodyDesc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    }
    if (vel) {
      bodyDesc.setLinvel(vel.x, vel.y, vel.z);
    }
    if (angVel) {
      bodyDesc.setAngvel({ x: angVel.x, y: angVel.y, z: angVel.z });
    }

    const body = this.world.createRigidBody(bodyDesc);
    const hx = Math.max(0.04, halfExtents.x);
    const hy = Math.max(0.04, halfExtents.y);
    const hz = Math.max(0.04, halfExtents.z);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setDensity(density)
        .setFriction(friction)
        .setRestitution(restitution),
      body
    );

    this.dynamicBodies.set(id, body);
    return id;
  }

  getBodyState(id) {
    const body = this.dynamicBodies.get(id);
    if (!body) return null;
    return {
      translation: body.translation(),
      rotation: body.rotation(),
      sleeping: body.isSleeping()
    };
  }

  removeDynamicBody(id) {
    if (!this.world || id == null) return;
    const body = this.dynamicBodies.get(id);
    if (body) {
      this.world.removeRigidBody(body);
      this.dynamicBodies.delete(id);
    }
  }

  step(dt) {
    if (!this.ready || !this.world) return;
    this.world.timestep = Math.min(0.033, Math.max(0.004, dt));
    this.world.step();
  }

  reset(blocks = []) {
    if (!this.ready) return;
    this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    this.staticBlockBodies.clear();
    this.dynamicBodies.clear();
    this._createGround();
    this.syncStaticBlocks(blocks);
  }
}
