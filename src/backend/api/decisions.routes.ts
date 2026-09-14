import express from "express";
import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";

const router = express.Router();

// Get decision logs
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_DECISION_LOG), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { role } = req.user;
  try {
    let logs: any[];
    const baseSelect = [
      'd.*',
      'u.name as creator_name',
      'u.role as creator_role',
      'r.name as reverser_name',
      't.name as tenant_name',
      'bu.name as bishop_name',
      't.governorate',
      's.name as student_name'
    ];
    if (role === 'admin') {
      logs = await kdb('decisions_log as d')
        .join('users as u', 'd.created_by', 'u.id')
        .leftJoin('users as r', 'd.reversed_by', 'r.id')
        .leftJoin('tenants as t', 'd.tenant_id', 't.id')
        .leftJoin('users as bu', 't.bishop_id', 'bu.id')
        .leftJoin('students as s', kdb.raw('s.id = JSON_VALUE(d.details, \'$.studentId\')'))
        .select(baseSelect)
        .orderBy('d.created_at', 'desc')
        .limit(200);
    } else if (tenantId) {
      logs = await kdb('decisions_log as d')
        .join('users as u', 'd.created_by', 'u.id')
        .leftJoin('users as r', 'd.reversed_by', 'r.id')
        .leftJoin('tenants as t', 'd.tenant_id', 't.id')
        .leftJoin('users as bu', 't.bishop_id', 'bu.id')
        .leftJoin('students as s', kdb.raw('s.id = JSON_VALUE(d.details, \'$.studentId\')'))
        .select(baseSelect)
        .where('d.tenant_id', tenantId)
        .orderBy('d.created_at', 'desc')
        .limit(100);
    } else {
      logs = [];
    }
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Create a decision log entry
router.post("/", authenticate, authorizePermission(AppPermission.UNDO_DECISION), async (req, res) => {
  const { action_type, details } = req.body;
  if (!action_type) return res.status(400).json({ success: false, message: "��� ������� �����" });

  const id = uuidv4();
  const tenantId = req.user.tenantId;

  try {
    await kdb('decisions_log').insert({
      id,
      tenant_id: tenantId || null,
      action_type,
      target_id: null,
      target_table: null,
      details: details || null,
      status: 'active',
      created_by: req.user.id,
      created_at: new Date()
    });
    res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// UNDO a decision
router.post("/:id/undo", authenticate, authorizePermission(AppPermission.UNDO_DECISION), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  const userId = req.user.id;

  try {
    await kdb.transaction(async trx => {
      const decision = await trx('decisions_log').where({ id, tenant_id: tenantId, status: 'active' }).first();
      if (!decision) throw new Error("Decision not found or already reversed");

      const { action_type, target_id, target_table } = decision;

      switch (action_type) {
        case 'ADD_POINTS':
          await trx('student_points').where({ id: target_id }).del();
          break;

        case 'MARK_ABSENT':
        case 'MARK_LATE':
        case 'MARK_ATTENDANCE':
          await trx('attendance').where({ id: target_id }).del();
          break;

        case 'ISSUE_WARNING':
          await trx('student_warnings').where({ id: target_id }).update({ status: 'reversed' });
          break;

        case 'APPROVE_REWARD':
          await trx('student_rewards').where({ id: target_id }).update({ status: 'reversed' });
          break;

        default:
          throw new Error(`Undo not implemented for action: ${action_type}`);
      }

      // Mark the log as reversed
      await trx('decisions_log')
        .where({ id })
        .update({ 
            status: 'reversed', 
            reversed_by: userId, 
            reversed_at: kdb.fn.now() 
        });
    });

    res.json({ success: true, message: "تم التراجع عن القرار بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
