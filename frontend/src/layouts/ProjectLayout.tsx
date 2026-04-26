import { Outlet, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { wsConnect, wsDisconnect } from "../store/middleware/wsListener";

export default function ProjectLayout() {
  const { projectId } = useParams();
  const dispatch = useDispatch();

  useEffect(() => {
	console.log("connect triggered: ", projectId);
    if (!projectId) return;

    dispatch(wsConnect(projectId));

    return () => {
      dispatch(wsDisconnect());
    };
  }, [dispatch, projectId]);

  return <Outlet />;
}
