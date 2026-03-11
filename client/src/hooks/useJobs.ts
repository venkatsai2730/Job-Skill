import { useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";

export interface Job {
    id: string;
    company: string;
    role: string;
    location?: string;
    salary?: string;
    status: 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
    match_score: number;
    starred: boolean;
    job_description?: string;
    job_url?: string;
    created_at: string;
    updated_at: string;
}

export function useJobs() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.get<{ jobs: Job[] }>("/api/jobs");
            setJobs(data.jobs);
        } catch (err: any) {
            setError(err.message || "Failed to fetch jobs");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const addJob = async (jobData: Partial<Job>) => {
        try {
            const data = await api.post<{ job: Job }>("/api/jobs", jobData);
            setJobs(prev => [data.job, ...prev]);
            return data.job;
        } catch (err: any) {
            throw err;
        }
    };

    const updateJob = async (id: string, updates: Partial<Job>) => {
        try {
            const data = await api.patch<{ job: Job }>(`/api/jobs/${id}`, updates);
            setJobs(prev => prev.map(job => (job.id === id ? data.job : job)));
            return data.job;
        } catch (err: any) {
            throw err;
        }
    };

    const deleteJob = async (id: string) => {
        try {
            await api.delete(`/api/jobs/${id}`);
            setJobs(prev => prev.filter(job => job.id !== id));
        } catch (err: any) {
            throw err;
        }
    };

    return { jobs, isLoading, error, refetch: fetchJobs, addJob, updateJob, deleteJob };
}
