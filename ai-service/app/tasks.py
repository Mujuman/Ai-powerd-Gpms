from app.celery_app import celery_app


@celery_app.task(name="ai_gpms.worker.health_check")
def health_check() -> str:
    return "worker-ready"
