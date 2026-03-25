const db = require('../config/db');

/**
 * FlowTriggerService
 * ─────────────────────────────────────────────────────────────
 * Handles tree-based automated replies.
 *
 * Logic:
 *  1. When a message arrives, find a flow_node of type 'keyword'
 *     that matches the incoming text.
 *  2. Follow flow_edges to find the next to_node_id.
 *  3. Execute the response (message, image, delay).
 *  4. Recursively continue if applicable (e.g. for multi-step).
 */
class FlowTriggerService {
    /**
     * Entry point for incoming messages.
     * @param {number} userId
     * @param {string} incomingBody
     * @param {Client} client
     * @param {string} contactPhone
     */
    static async handleInbound(userId, incomingBody, client, contactPhone) {
        try {
            // Find a matching keyword trigger node for this user
            // In a real system, we'd use index-friendly exact match or fuzzy search
            const [nodes] = await db.query(`
                SELECT * FROM flow_nodes
                WHERE user_id = ?
                  AND type = 'keyword'
                  AND JSON_CONTAINS(content, ?, '$.keywords')
                LIMIT 1
            `, [userId, JSON.stringify(incomingBody.toLowerCase().trim())]);

            if (nodes.length === 0) return false;

            const triggerNode = nodes[0];
            await this.executeNextNode(triggerNode.id, client, contactPhone, userId);
            return true;
        } catch (err) {
            console.error('[FlowTriggerService] Error:', err.message);
            return false;
        }
    }

    /**
     * Follow edges from a node and execute the next node in the path.
     * @param {number} fromNodeId
     * @param {Client} client
     * @param {string} contactPhone
     * @param {number} userId
     */
    static async executeNextNode(fromNodeId, client, contactPhone, userId) {
        try {
            const [edges] = await db.query(`
                SELECT to_node_id FROM flow_edges WHERE from_node_id = ?
            `, [fromNodeId]);

            for (const edge of edges) {
                const [[node]] = await db.query(`
                    SELECT * FROM flow_nodes WHERE id = ?
                `, [edge.to_node_id]);

                if (!node) continue;

                // Handle node types
                if (node.type === 'message') {
                    const message = node.content.text;
                    await client.sendMessage(contactPhone + '@c.us', message);

                    // Log the outbound message
                    await db.query(`
                        INSERT INTO chat_logs (user_id, contact_phone, body, direction)
                        VALUES (?, ?, ?, 'out')
                    `, [userId, contactPhone, message, 'out']);

                    // Recurse to follow edges from this message node
                    await this.executeNextNode(node.id, client, contactPhone, userId);
                } else if (node.type === 'delay') {
                    const delayMs = parseInt(node.content.ms || 1000, 10);
                    await new Promise(r => setTimeout(r, delayMs));

                    // Recurse to follow edges from this delay node
                    await this.executeNextNode(node.id, client, contactPhone, userId);
                }
                // (More node types like 'condition' would be implemented here)
            }
        } catch (err) {
            console.error('[FlowTriggerService] Execution Error:', err.message);
        }
    }
}

module.exports = FlowTriggerService;
