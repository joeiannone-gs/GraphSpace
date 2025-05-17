export const styles = {
  panel: {
    position: 'absolute',
    borderRadius: '10px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 15px',
    borderRadius: '10px'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '25px'
  },
  headerText: {
    fontFamily: 'CenturyGothic'
  },
  headerControls: {
    display: 'flex',
    gap: '10px'
  },
  controlIcon: {
    cursor: 'pointer'
  }
} as const; 