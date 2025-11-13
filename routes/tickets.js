// routes/tickets.js - COMPLETE FINAL VERSION
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { Interactions } = require('../config/mongodb');

router.use(authenticateToken);

// Get ticket information by interaction ID
router.get('/by-interaction/:interactionId', async (req, res) => {
  try {
    const { interactionId } = req.params;
    
    console.log(`Fetching ticket information for interaction ID: ${interactionId}`);
    
    // Step 1: Fetch interaction from MongoDB
    const interaction = await Interactions.findById(interactionId).lean();
    
    if (!interaction) {
      return res.status(404).json({
        success: false,
        message: 'Interaction not found'
      });
    }
    
    // Step 2: Check if interaction has a ticketId in extraPayload
    const ticketId = interaction.extraPayload?.ticketId;
    
    if (!ticketId) {
      return res.status(404).json({
        success: false,
        message: 'No ticket associated with this interaction',
        hasTicket: false
      });
    }
    
    console.log(`Found ticketId ${ticketId} in interaction extraPayload`);
    
    // Step 3: Fetch ticket data from MySQL - SELECT ALL COLUMNS
    const query = `
      SELECT
        t.*,
        tp.name AS pipeline,
        ts.name AS pipelineStage,
        tpr.name AS priority,
        tm.team_name AS team,
        CONCAT_WS(' ', tmm.first_name, tmm.last_name) AS teamMember,
        GROUP_CONCAT(DISTINCT wc.name ORDER BY jt1.ord SEPARATOR ', ') AS tags,  
        GROUP_CONCAT(DISTINCT tw.name ORDER BY jt.ord SEPARATOR ', ') AS workflow,
        CONCAT_WS(' ', uc.first_name, uc.last_name) AS createdBy,
        CONCAT_WS(' ', uu.first_name, uu.last_name) AS updatedBy,
        CONCAT_WS(' ', ucl.first_name, ucl.last_name) AS closedBy,
        CASE WHEN t.status = 0 THEN 'Closed' ELSE 'Open' END AS statusLabel,
        CONCAT_WS(' ', c.firstName, c.lastName) AS customer,
        cc.name AS company,
        CASE WHEN t.slaBreach = 0 THEN 'No' ELSE 'Yes' END AS slaBreachLabel,
        CONCAT(
          FLOOR(t.ticketLife/86400), 'd ', 
          FLOOR(MOD(t.ticketLife,86400)/3600), 'h ', 
          FLOOR(MOD(t.ticketLife,3600)/60), 'm'
        ) AS ticketLifeFormatted,
        tsla.name AS slaName
      FROM
        yovo_tbl_tickets_info AS t
        LEFT OUTER JOIN yovo_tbl_ticket_pipelines AS tp
          ON t.pipeline = tp.id
        LEFT OUTER JOIN yovo_tbl_ticket_stages AS ts
          ON t.pipelineStage = ts.id
        LEFT OUTER JOIN yovo_tbl_ticket_priorities AS tpr
          ON t.priority = tpr.id
        LEFT OUTER JOIN yovo_tbl_users AS uc
          ON t.createdBy = uc.id
        LEFT OUTER JOIN yovo_tbl_users AS uu
          ON t.updatedBy = uu.id
        LEFT OUTER JOIN yovo_tbl_users AS ucl
          ON t.closedBy = ucl.id
        LEFT OUTER JOIN yovo_tbl_users AS tmm
          ON t.teamMember = tmm.id  
        LEFT OUTER JOIN yovo_tbl_teams AS tm
          ON t.team = tm.id
        LEFT OUTER JOIN yovo_tbl_adb_customers AS c
          ON t.customer = c.id
        LEFT OUTER JOIN yovo_tbl_adb_companies AS cc
          ON t.company = cc.id  
        LEFT OUTER JOIN yovo_tbl_ticket_slas AS tsla
          ON t.slaId = tsla.id 
        LEFT JOIN JSON_TABLE(
               CAST(t.workflow AS JSON),
               '$[*]' COLUMNS (
                 ORD   FOR ORDINALITY,
                 wf_id INT PATH '$'
               )
             ) AS jt
          ON TRUE
        LEFT JOIN yovo_tbl_ticket_workflows AS tw
          ON tw.id = jt.wf_id
        LEFT JOIN JSON_TABLE(
               CAST(t.tags AS JSON),
               '$[*]' COLUMNS (
                 ORD   FOR ORDINALITY,
                 wf_id INT PATH '$'
               )
             ) AS jt1
          ON TRUE
        LEFT JOIN yovo_tbl_work_codes AS wc
          ON wc.id = jt1.wf_id
      WHERE t.id = ?
      GROUP BY t.id
    `;
    
    const [rows] = await pool.execute(query, [ticketId]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Ticket not found in database',
        hasTicket: true,
        ticketId: ticketId
      });
    }
    
    const ticket = rows[0];
    
    // Define the standard/known fields (these will be in main sections)
    const standardFields = [
      'id', 'ticketNumber', 'subject', 'description', 'status', 'statusLabel',
      'pipeline', 'pipelineStage', 'priority', 'team', 'teamMember',
      'customer', 'company', 'channel', 'tags', 'workflow',
      'noOfActivities', 'firstResponseTill', 'dueDate', 'slaBreach', 'slaBreachLabel',
      'ticketLife', 'ticketLifeFormatted', 'createdAt', 'updatedAt', 'closedAt',
      'createdBy', 'updatedBy', 'closedBy, slaId, slaName'
    ];
    
    // Extract custom/dynamic fields (any field not in the standard list)
    const customFields = {};
    Object.keys(ticket).forEach(key => {
      if (!standardFields.includes(key)) {
        customFields[key] = ticket[key];
      }
    });
    
    console.log(`Found ${Object.keys(customFields).length} custom fields`);
    
    // Format the response
    const formattedTicket = {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.statusLabel,
      pipeline: ticket.pipeline,
      pipelineStage: ticket.pipelineStage,
      priority: ticket.priority,
      team: ticket.team,
      teamMember: ticket.teamMember,
      customer: ticket.customer,
      company: ticket.company,
      channel: ticket.channel,
      tags: ticket.tags ? ticket.tags.split(', ') : [],
      workflow: ticket.workflow ? ticket.workflow.split(', ') : [],
      noOfActivities: ticket.noOfActivities || 0,
      firstResponseTill: ticket.firstResponseTill,
      dueDate: ticket.dueDate,
      slaBreach: ticket.slaBreachLabel,
      ticketLife: ticket.ticketLifeFormatted,
      slaName: ticket.slaName,
      timestamps: {
        createdAt: ticket.createdAt,
        createdBy: ticket.createdBy,
        updatedAt: ticket.updatedAt,
        updatedBy: ticket.updatedBy,
        closedAt: ticket.closedAt,
        closedBy: ticket.closedBy
      },
      // Include all custom/dynamic fields
      customFields: customFields
    };
    
    console.log('@@@@@@@@@@@@@@@', formattedTicket);

    res.json({
      success: true,
      hasTicket: true,
      ticket: formattedTicket
    });
    
  } catch (error) {
    console.error('Error fetching ticket information:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching ticket information',
      error: error.message 
    });
  }
});

module.exports = router;