import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const secret = req.headers['x-admin-secret'];

    // Guard endpoint against unauthorized triggers
    if (!secret || secret !== process.env.ADMIN_TRIGGER_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;
    const pat = process.env.GITHUB_DISPATCH_PAT;

    if (!repoOwner || !repoName || !pat) {
        return res.status(500).json({ error: 'Server missing GitHub dispatch credentials' });
    }

    try {
        // Trigger the workflow_dispatch via GitHub REST API
        const ghResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/recalibrate.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${pat}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({ ref: 'main' }),
            }
        );

        if (!ghResponse.ok) {
            const errorText = await ghResponse.text();
            return res.status(ghResponse.status).json({
                error: 'GitHub dispatch failed',
                details: errorText,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Recalibration dispatched successfully.',
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error),
        });
    }
}